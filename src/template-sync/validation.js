import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

function runCommand(command, args, { cwd, timeoutMs = 10 * 60 * 1000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, shell: false });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
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
      resolve({ command: [command, ...args].join(" "), exitCode: 127, stdout, stderr: error.message });
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ command: [command, ...args].join(" "), exitCode, stdout, stderr });
    });
  });
}

export function readPackageScripts(root) {
  const packageJsonPath = path.join(root, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(packageJsonPath, "utf8")).scripts || {};
}

export async function refreshDependencies({ root, changedFiles }) {
  if (!changedFiles.some((file) => file === "package.json" || file.endsWith("/package.json"))) {
    return [];
  }
  if (fs.existsSync(path.join(root, "pnpm-lock.yaml"))) {
    return [await runCommand("pnpm", ["install", "--lockfile-only"], { cwd: root })];
  }
  if (fs.existsSync(path.join(root, "package-lock.json"))) {
    return [await runCommand("npm", ["install", "--package-lock-only"], { cwd: root })];
  }
  if (fs.existsSync(path.join(root, "yarn.lock"))) {
    return [await runCommand("yarn", ["install", "--mode", "update-lockfile"], { cwd: root })];
  }
  return [];
}

export async function runValidation({ root }) {
  const scripts = readPackageScripts(root);
  const commands = ["lint", "typecheck", "test"].filter((scriptName) => scripts[scriptName]);
  const results = [];
  for (const scriptName of commands) {
    results.push(await runCommand("pnpm", [scriptName], { cwd: root }));
  }
  return results;
}
