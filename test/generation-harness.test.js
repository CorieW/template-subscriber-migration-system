import test from "node:test";
import assert from "node:assert/strict";
import {
  callGenerationHarness,
  generationHarnessEnvironment,
  isProtectedGenerationHarnessEnvName,
  parseHarnessCommand,
  parseHarnessEnvAllowlist,
} from "../src/template-sync/generation-harness.js";

test("parses generation harness commands from JSON arrays and shell-like strings", () => {
  assert.deepEqual(parseHarnessCommand('["opencode","run","--json"]'), ["opencode", "run", "--json"]);
  assert.deepEqual(parseHarnessCommand('opencode run --prompt "use settings module"'), [
    "opencode",
    "run",
    "--prompt",
    "use settings module",
  ]);
  assert.throws(() => parseHarnessCommand("opencode 'unterminated"), /unterminated quote/);
});

test("runs a generation harness with prompt stdin and validates returned plan", async () => {
  const script = `
    let stdin = "";
    process.stdin.on("data", (chunk) => { stdin += chunk; });
    process.stdin.on("end", () => {
      const prompt = JSON.parse(stdin);
      console.log(JSON.stringify({
        summary: "Harness handled " + prompt.mode,
        rationale: "Used test harness",
        driftWarnings: [],
        operations: [{ action: "create", path: "src/app.ts", content: "export const value = 1;\\n" }]
      }));
    });
  `;

  const plan = await callGenerationHarness({
    command: [process.execPath, "-e", script],
    prompt: { mode: "approve" },
    env: { PATH: process.env.PATH },
    cwd: process.cwd(),
  });

  assert.equal(plan.summary, "Harness handled approve");
  assert.deepEqual(plan.operations, [{ action: "create", path: "src/app.ts", content: "export const value = 1;\n" }]);
});

test("lets harness write generation output to the provided output path", async () => {
  const script = `
    const fs = require("node:fs");
    fs.writeFileSync(process.env.TEMPLATE_SYNC_GENERATION_OUTPUT_PATH, JSON.stringify({
      summary: "Output file plan",
      rationale: "Used output file",
      driftWarnings: [],
      operations: []
    }));
    console.log("non-json logs stay on stdout");
  `;

  const plan = await callGenerationHarness({
    command: [process.execPath, "-e", script],
    prompt: { mode: "revise" },
    env: { PATH: process.env.PATH },
    cwd: process.cwd(),
  });

  assert.equal(plan.summary, "Output file plan");
});

test("redacts allowlisted sensitive environment values from harness failures", async () => {
  const script = "console.error(process.env.OPENAI_API_KEY); process.exit(1);";

  await assert.rejects(
    () =>
      callGenerationHarness({
        command: [process.execPath, "-e", script],
        prompt: { mode: "approve" },
        env: { PATH: process.env.PATH, OPENAI_API_KEY: "model-secret-value" },
        cwd: process.cwd(),
        allowedSensitiveEnvNames: ["OPENAI_API_KEY"],
      }),
    (error) => {
      assert.match(error.message, /\[redacted OPENAI_API_KEY]/);
      assert.doesNotMatch(error.message, /model-secret-value/);
      return true;
    },
  );
});

test("sanitizes generation harness environment unless sensitive names are explicitly allowed", () => {
  assert.deepEqual(parseHarnessEnvAllowlist(" OPENAI_API_KEY, ANTHROPIC_API_KEY "), [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
  ]);
  assert.deepEqual(
    generationHarnessEnvironment({
      env: {
        PATH: "/bin",
        OPENAI_API_KEY: "model-secret",
        TEMPLATE_SYNC_BOT_TOKEN: "bot-secret",
        NORMAL: "1",
      },
    }),
    { PATH: "/bin", NORMAL: "1" },
  );
  assert.equal(
    generationHarnessEnvironment({
      env: { OPENAI_API_KEY: "model-secret" },
      allowedSensitiveEnvNames: ["OPENAI_API_KEY"],
    }).OPENAI_API_KEY,
    "model-secret",
  );
  assert.throws(
    () =>
      generationHarnessEnvironment({
        env: { TEMPLATE_SYNC_BOT_TOKEN: "bot-secret" },
        allowedSensitiveEnvNames: ["TEMPLATE_SYNC_BOT_TOKEN"],
      }),
    /Refusing to pass protected environment variable/,
  );
  assert.equal(isProtectedGenerationHarnessEnvName("github_token"), true);
  assert.equal(isProtectedGenerationHarnessEnvName("ANTHROPIC_API_KEY"), false);
});
