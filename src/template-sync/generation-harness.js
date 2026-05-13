import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { parseAndValidateGenerationPlan } from "./generation-contract.js";
import { truncate } from "./utils.js";
import { isSensitiveEnvironmentName } from "./validation.js";

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_FAILURE_OUTPUT_LENGTH = 4000;
const ENV_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const PROTECTED_GENERATION_HARNESS_ENV_NAMES = Object.freeze([
  "GH_TOKEN",
  "GITHUB_TOKEN",
  "TEMPLATE_SYNC_BOT_TOKEN",
  "TEMPLATE_SYNC_UPSTREAM_READ_TOKEN",
]);

export function isProtectedGenerationHarnessEnvName(name) {
  const normalizedName = String(name || "").toUpperCase();
  return (
    PROTECTED_GENERATION_HARNESS_ENV_NAMES.includes(normalizedName) ||
    /^(?:GH|GITHUB|ACTIONS)_.*(?:TOKEN|PAT|KEY|SECRET|CREDENTIAL|AUTH)(?:_|$)/.test(normalizedName) ||
    /^TEMPLATE_SYNC_.*(?:TOKEN|PAT|KEY|SECRET|CREDENTIAL|AUTH)(?:_|$)/.test(normalizedName)
  );
}

export function parseHarnessCommand(command) {
  if (Array.isArray(command)) {
    if (command.length === 0 || command.some((part) => typeof part !== "string" || !part.trim())) {
      throw new Error("Generation harness command must be a non-empty array of strings");
    }
    return command;
  }

  const text = String(command || "").trim();
  if (!text) {
    throw new Error("Generation harness command must be set");
  }
  if (text.startsWith("[")) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error(`Generation harness command JSON is invalid: ${error.message}`);
    }
    return parseHarnessCommand(parsed);
  }

  const parts = [];
  let current = "";
  let quote = "";
  let escaping = false;
  for (const character of text) {
    if (escaping) {
      current += character;
      escaping = false;
      continue;
    }
    if (character === "\\" && quote !== "'") {
      escaping = true;
      continue;
    }
    if (quote) {
      if (character === quote) {
        quote = "";
      } else {
        current += character;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (/\s/.test(character)) {
      if (current) {
        parts.push(current);
        current = "";
      }
      continue;
    }
    current += character;
  }
  if (escaping) {
    throw new Error("Generation harness command has a trailing escape");
  }
  if (quote) {
    throw new Error("Generation harness command has an unterminated quote");
  }
  if (current) {
    parts.push(current);
  }
  if (parts.length === 0) {
    throw new Error("Generation harness command must be set");
  }
  return parts;
}

export function parseHarnessEnvAllowlist(value) {
  return String(value || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

export function generationHarnessEnvironment({ env = process.env, allowedSensitiveEnvNames = [] } = {}) {
  const harnessEnv = Object.fromEntries(Object.entries(env).filter(([name]) => !isSensitiveEnvironmentName(name)));
  for (const rawName of allowedSensitiveEnvNames) {
    const name = String(rawName || "").trim();
    if (!name) {
      continue;
    }
    if (!ENV_NAME_PATTERN.test(name)) {
      throw new Error(`Invalid generation harness environment variable name: ${name}`);
    }
    if (isProtectedGenerationHarnessEnvName(name)) {
      throw new Error(`Refusing to pass protected environment variable to generation harness: ${name}`);
    }
    if (env[name] !== undefined) {
      harnessEnv[name] = env[name];
    }
  }
  return harnessEnv;
}

function redactHarnessOutput(value, env, allowedSensitiveEnvNames) {
  let text = String(value || "");
  for (const name of allowedSensitiveEnvNames) {
    const secret = env[name];
    if (secret && secret.length >= 4) {
      text = text.replaceAll(secret, `[redacted ${name}]`);
    }
  }
  return text;
}

function runHarnessProcess(command, args, { cwd, env, stdin, timeoutMs }) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, env, shell: false, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ exitCode: 127, signal: null, stdout, stderr: error.message, timedOut });
    });
    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      resolve({ exitCode, signal, stdout, stderr, timedOut });
    });
    child.stdin.end(stdin);
  });
}

function readHarnessOutput(outputPath, stdout) {
  if (fs.existsSync(outputPath)) {
    const fileOutput = fs.readFileSync(outputPath, "utf8").trim();
    if (fileOutput) {
      return fileOutput;
    }
  }
  return stdout.trim();
}

export async function callGenerationHarness({
  command,
  prompt,
  cwd,
  env = process.env,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  allowedSensitiveEnvNames = parseHarnessEnvAllowlist(env.TEMPLATE_SYNC_GENERATION_HARNESS_ENV_ALLOWLIST),
}) {
  const [bin, ...args] = parseHarnessCommand(command);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "template-sync-harness-"));
  const promptPath = path.join(tempDir, "prompt.json");
  const outputPath = path.join(tempDir, "generation-plan.json");
  const stdin = `${JSON.stringify(prompt, null, 2)}\n`;
  fs.writeFileSync(promptPath, stdin, "utf8");

  try {
    const result = await runHarnessProcess(bin, args, {
      cwd,
      env: {
        ...generationHarnessEnvironment({ env, allowedSensitiveEnvNames }),
        TEMPLATE_SYNC_GENERATION_PROMPT_PATH: promptPath,
        TEMPLATE_SYNC_GENERATION_OUTPUT_PATH: outputPath,
      },
      stdin,
      timeoutMs,
    });
    if (result.timedOut) {
      throw new Error(`Generation harness timed out after ${timeoutMs}ms`);
    }
    if (result.exitCode !== 0) {
      const detail = truncate(
        redactHarnessOutput(result.stderr || result.stdout, env, allowedSensitiveEnvNames),
        MAX_FAILURE_OUTPUT_LENGTH,
      ).trim();
      throw new Error(`Generation harness failed (${result.exitCode ?? result.signal}): ${detail || "no output"}`);
    }

    const output = readHarnessOutput(outputPath, result.stdout);
    if (!output) {
      throw new Error("Generation harness did not return a generation plan");
    }
    return parseAndValidateGenerationPlan(output);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
