import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  applyGenerationPlan,
  parseAndValidateGenerationPlan,
  validateGenerationPlan
} from "../src/template-sync/generation-contract.js";
import { scoreDrift } from "../src/template-sync/drift.js";

test("validates and applies create, update, and delete operations", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "template-sync-"));
  fs.writeFileSync(path.join(root, "existing.txt"), "old", "utf8");
  fs.writeFileSync(path.join(root, "remove.txt"), "delete me", "utf8");

  const plan = validateGenerationPlan({
    summary: "Update files",
    operations: [
      { action: "create", path: "new/file.txt", content: "new content\n" },
      { action: "update", path: "existing.txt", content: "new content\n" },
      { action: "delete", path: "remove.txt" }
    ],
    driftWarnings: []
  });

  assert.deepEqual(applyGenerationPlan(plan, { root }), ["new/file.txt", "existing.txt", "remove.txt"]);
  assert.equal(fs.readFileSync(path.join(root, "new/file.txt"), "utf8"), "new content\n");
  assert.equal(fs.readFileSync(path.join(root, "existing.txt"), "utf8"), "new content\n");
  assert.equal(fs.existsSync(path.join(root, "remove.txt")), false);
});

test("rejects malformed model output", () => {
  assert.throws(
    () =>
      validateGenerationPlan({
        summary: "bad",
        operations: [{ action: "update", path: "../escape.txt", content: "no" }]
      }),
    /Malformed generation output/
  );
  assert.throws(() => parseAndValidateGenerationPlan("not json"), /Unexpected token/);
});

test("reports drift warnings but does not block generation", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "template-sync-"));
  const drift = scoreDrift({
    root,
    bundle: {
      changedFiles: [{ filename: "src/missing.ts", status: "modified" }]
    }
  });
  assert.equal(drift.level, "medium");
  assert.match(drift.warnings[0], /does not exist/);
});
