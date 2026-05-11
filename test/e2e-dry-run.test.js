import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createMigrationBundle } from "../src/template-sync/bundle.js";
import { selectNewestMigrationRelease } from "../src/template-sync/releases.js";
import { renderMigrationPrBody } from "../src/template-sync/render.js";
import { parseTemplateSyncCommand } from "../src/template-sync/commands.js";
import {
  buildGenerationPrompt,
  buildMigrationSummaryPrompt,
  validateMigrationSummaryOutput,
} from "../src/template-sync/openai.js";
import { applyGenerationPlan, validateGenerationPlan } from "../src/template-sync/generation-contract.js";

function pr(number, publishedAt) {
  return {
    number,
    html_url: `https://github.com/acme/template/pull/${number}`,
    title: `Template PR ${number}`,
    body: `Body for ${number}`,
    labels: [],
    merged: true,
    merged_at: publishedAt,
    merge_commit_sha: `${number}`.padStart(40, "a"),
    base: { ref: "main", repo: { full_name: "acme/template" } },
  };
}

test("dry-run publish subscribe approve revise lifecycle with mocked generation", () => {
  const olderBundle = createMigrationBundle({
    templateRepoFullName: "acme/template",
    pullRequest: pr(1, "2026-04-20T00:00:00Z"),
    files: [{ filename: "src/app.ts", status: "modified" }],
    unifiedDiff: "old diff",
  });
  const newerBundle = createMigrationBundle({
    templateRepoFullName: "acme/template",
    pullRequest: pr(2, "2026-04-29T00:00:00Z"),
    files: [{ filename: "src/app.ts", status: "modified" }],
    unifiedDiff: "new diff",
  });
  const newest = selectNewestMigrationRelease([
    {
      tag_name: olderBundle.migration.id,
      published_at: "2026-04-20T01:00:00Z",
      draft: false,
      prerelease: false,
    },
    {
      tag_name: newerBundle.migration.id,
      published_at: "2026-04-29T01:00:00Z",
      draft: false,
      prerelease: false,
    },
  ]);

  assert.equal(newest.tag_name, newerBundle.migration.id);
  assert.match(renderMigrationPrBody(newerBundle), /No code has been generated yet/);

  const summaryPrompt = buildMigrationSummaryPrompt({ bundle: newerBundle });
  assert.equal(summaryPrompt.migrationBundle.migration.id, newerBundle.migration.id);
  const summary = validateMigrationSummaryOutput({ summary: "Updates the app entrypoint for generated subscribers." });
  const summarizedBundle = { ...newerBundle, generatedSummary: summary.summary };
  assert.match(renderMigrationPrBody(summarizedBundle), /Template Change Summary/);
  assert.match(renderMigrationPrBody(summarizedBundle), /Updates the app entrypoint/);

  const approve = parseTemplateSyncCommand("/template-sync approve\nKeep the subscriber theme.");
  const approvePrompt = buildGenerationPrompt({
    mode: "approve",
    bundle: newerBundle,
    repoContext: { affectedFiles: [], configFiles: [] },
    instructions: approve.instructions,
    priorGenerationSummaries: [],
    drift: { level: "low", warnings: [] },
    allowedOperationPaths: ["src/app.ts"],
  });
  assert.equal(approvePrompt.adminInstructions, "Keep the subscriber theme.");
  assert.deepEqual(approvePrompt.allowedOperationPaths, ["src/app.ts"]);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "template-sync-e2e-"));
  const allowedPaths = ["src/app.ts"];
  const initialPlan = validateGenerationPlan(
    {
      summary: "Created subscriber migration",
      operations: [{ action: "create", path: "src/app.ts", content: "export const value = 1;\n" }],
      driftWarnings: [],
    },
    { allowedPaths },
  );
  assert.deepEqual(applyGenerationPlan(initialPlan, { root, allowedPaths }), ["src/app.ts"]);

  const revise = parseTemplateSyncCommand("/template-sync revise\nUse value 2 instead.");
  const revisePrompt = buildGenerationPrompt({
    mode: "revise",
    bundle: newerBundle,
    repoContext: {
      affectedFiles: [
        { path: "src/app.ts", exists: true, content: fs.readFileSync(path.join(root, "src/app.ts"), "utf8") },
      ],
      configFiles: [],
    },
    instructions: revise.instructions,
    priorGenerationSummaries: [{ body: "Created subscriber migration" }],
    drift: { level: "low", warnings: [] },
    allowedOperationPaths: allowedPaths,
  });
  assert.equal(revisePrompt.adminInstructions, "Use value 2 instead.");
  assert.equal(revisePrompt.priorGenerationSummaries.length, 1);

  const revisionPlan = validateGenerationPlan(
    {
      summary: "Revised subscriber migration",
      operations: [{ action: "update", path: "src/app.ts", content: "export const value = 2;\n" }],
      driftWarnings: [],
    },
    { allowedPaths },
  );
  applyGenerationPlan(revisionPlan, { root, allowedPaths });
  assert.equal(fs.readFileSync(path.join(root, "src/app.ts"), "utf8"), "export const value = 2;\n");
});
