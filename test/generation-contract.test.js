import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  applyGenerationPlan,
  GENERATION_RESPONSE_SCHEMA,
  parseAndValidateGenerationPlan,
  validateGenerationPlan,
} from "../src/template-sync/generation-contract.js";
import { scoreDrift } from "../src/template-sync/drift.js";
import {
  commandEnvironment,
  detectPackageManager,
  isSensitiveEnvironmentName,
  packageScriptCommand,
  runValidation,
} from "../src/template-sync/validation.js";

test("validates and applies create, update, and delete operations", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "template-sync-"));
  fs.writeFileSync(path.join(root, "existing.txt"), "old", "utf8");
  fs.writeFileSync(path.join(root, "remove.txt"), "delete me", "utf8");

  const plan = validateGenerationPlan({
    summary: "Update files",
    operations: [
      { action: "create", path: "new/file.txt", content: "new content\n" },
      { action: "update", path: "existing.txt", content: "new content\n" },
      { action: "delete", path: "remove.txt" },
    ],
    driftWarnings: [],
  });

  assert.deepEqual(applyGenerationPlan(plan, { root }), ["new/file.txt", "existing.txt", "remove.txt"]);
  assert.equal(fs.readFileSync(path.join(root, "new/file.txt"), "utf8"), "new content\n");
  assert.equal(fs.readFileSync(path.join(root, "existing.txt"), "utf8"), "new content\n");
  assert.equal(fs.existsSync(path.join(root, "remove.txt")), false);
});

test("generation schema is valid for strict OpenAI structured outputs", () => {
  const operationSchema = GENERATION_RESPONSE_SCHEMA.properties.operations.items;

  assert.deepEqual(operationSchema.required, Object.keys(operationSchema.properties));
  assert.deepEqual(operationSchema.properties.content.type, ["string", "null"]);
});

test("rejects malformed model output", () => {
  assert.throws(
    () =>
      validateGenerationPlan({
        summary: "bad",
        operations: [{ action: "update", path: "../escape.txt", content: "no" }],
      }),
    /Malformed generation output/,
  );
  assert.throws(
    () =>
      validateGenerationPlan({
        summary: "bad",
        operations: [{ action: "delete", path: ".git" }],
      }),
    /Unsafe file operation path/,
  );
  assert.throws(
    () =>
      validateGenerationPlan({
        summary: "bad",
        operations: [{ action: "delete", path: "nested/.git/config" }],
      }),
    /Unsafe file operation path/,
  );
  assert.throws(
    () =>
      validateGenerationPlan({
        summary: "bad",
        operations: [{ action: "delete", path: "remove.txt", content: "unexpected" }],
      }),
    /content must be null or omitted/,
  );
  assert.throws(() => parseAndValidateGenerationPlan("not json"), /Unexpected token/);
});

test("rejects generation paths outside bundle scope or execution-sensitive files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "template-sync-"));
  const allowedPaths = ["src/app.ts"];
  const plan = validateGenerationPlan(
    {
      summary: "Update file",
      operations: [{ action: "update", path: "src/app.ts", content: "export const ok = true;\n" }],
      driftWarnings: [],
    },
    { allowedPaths },
  );

  assert.deepEqual(applyGenerationPlan(plan, { root, allowedPaths }), ["src/app.ts"]);
  assert.throws(
    () =>
      validateGenerationPlan(
        {
          summary: "Bad path",
          operations: [{ action: "create", path: "src/extra.ts", content: "export const nope = true;\n" }],
          driftWarnings: [],
        },
        { allowedPaths },
      ),
    /outside the migration bundle/,
  );
  assert.throws(
    () =>
      validateGenerationPlan(
        {
          summary: "Bad package script path",
          operations: [{ action: "update", path: "packages/app/package.json", content: "{}\n" }],
          driftWarnings: [],
        },
        { allowedPaths: ["packages/app/package.json"] },
      ),
    /execution-sensitive path/,
  );
  assert.throws(
    () =>
      validateGenerationPlan(
        {
          summary: "Bad workflow path",
          operations: [{ action: "create", path: ".github/workflows/ci.yml", content: "name: ci\n" }],
          driftWarnings: [],
        },
        { allowedPaths: [".github/workflows/ci.yml"] },
      ),
    /execution-sensitive path/,
  );
  assert.throws(
    () =>
      applyGenerationPlan(
        {
          operations: [{ action: "create", path: "src/extra.ts", content: "export const nope = true;\n" }],
        },
        { root, allowedPaths },
      ),
    /outside the migration bundle/,
  );
});

test("reports drift warnings but does not block generation", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "template-sync-"));
  const drift = scoreDrift({
    root,
    bundle: {
      changedFiles: [{ filename: "src/missing.ts", status: "modified" }],
    },
  });
  assert.equal(drift.level, "medium");
  assert.match(drift.warnings[0], /does not exist/);
});

test("selects validation package manager from package metadata and lockfiles", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "template-sync-"));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ packageManager: "yarn@4.5.0" }), "utf8");
  assert.equal(detectPackageManager(root), "yarn");
  assert.deepEqual(packageScriptCommand("yarn", "lint"), { command: "corepack", args: ["yarn", "lint"] });

  const npmRoot = fs.mkdtempSync(path.join(os.tmpdir(), "template-sync-"));
  fs.writeFileSync(path.join(npmRoot, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }), "utf8");
  fs.writeFileSync(path.join(npmRoot, "package-lock.json"), "{}", "utf8");
  assert.equal(detectPackageManager(npmRoot), "npm");
  assert.deepEqual(packageScriptCommand("npm", "test"), { command: "npm", args: ["run", "test"] });
});

test("reports invalid root package json as validation failure", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "template-sync-"));
  fs.writeFileSync(path.join(root, "package.json"), "{ invalid json", "utf8");

  const results = await runValidation({ root });

  assert.equal(results.length, 1);
  assert.equal(results[0].command, "parse package.json");
  assert.equal(results[0].exitCode, 1);
  assert.match(results[0].stderr, /Invalid package\.json/);
});

test("disables corepack package manager auto-pinning", () => {
  assert.equal(commandEnvironment("corepack", {}).COREPACK_ENABLE_AUTO_PIN, "0");
  assert.equal(commandEnvironment("corepack", {}).YARN_ENABLE_SCRIPTS, "0");
  assert.deepEqual(
    commandEnvironment("npm", {
      EXISTING: "1",
      OPENAI_API_KEY: "secret",
      TEMPLATE_SYNC_BOT_TOKEN: "token",
      NPM_CONFIG_TOKEN: "npm-token",
    }),
    { EXISTING: "1" },
  );
  assert.equal(isSensitiveEnvironmentName("TEMPLATE_SYNC_UPSTREAM_READ_TOKEN"), true);
  assert.equal(isSensitiveEnvironmentName("EXISTING"), false);
});
