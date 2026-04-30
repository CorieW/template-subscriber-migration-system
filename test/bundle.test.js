import test from "node:test";
import assert from "node:assert/strict";
import { createMigrationBundle, deriveMigrationIdFromPullRequest } from "../src/template-sync/bundle.js";

function mergedPullRequest(overrides = {}) {
  return {
    number: 42,
    html_url: "https://github.com/acme/template/pull/42",
    title: "Add stricter linting",
    body: "Updates lint rules for generated apps.",
    labels: [{ name: "maintenance" }],
    merged: true,
    merged_at: "2026-04-28T10:00:00Z",
    merge_commit_sha: "0123456789abcdef0123456789abcdef01234567",
    base: {
      ref: "main",
      repo: {
        full_name: "acme/template"
      }
    },
    ...overrides
  };
}

test("builds a stable migration bundle from merged PR data", () => {
  const pr = mergedPullRequest();
  const bundle = createMigrationBundle({
    templateRepoFullName: "acme/template",
    pullRequest: pr,
    files: [
      { filename: "src/app.ts", status: "modified", additions: 5, deletions: 2, changes: 7 },
      { filename: "package.json", status: "modified", additions: 1, deletions: 1, changes: 2 }
    ],
    unifiedDiff: "diff --git a/package.json b/package.json"
  });

  assert.equal(deriveMigrationIdFromPullRequest(pr), "template-migration/pr-42-0123456789ab");
  assert.equal(bundle.migration.id, "template-migration/pr-42-0123456789ab");
  assert.equal(bundle.templateRepository.branch, "main");
  assert.equal(bundle.sourcePullRequest.mergedInto, "main");
  assert.deepEqual(
    bundle.changedFiles.map((file) => file.filename),
    ["package.json", "src/app.ts"]
  );
  assert.match(bundle.sourceSummary, /Add stricter linting/);
  assert.match(bundle.unifiedDiff, /diff --git/);
});

test("rejects unmerged PRs", () => {
  assert.throws(
    () =>
      createMigrationBundle({
        templateRepoFullName: "acme/template",
        pullRequest: mergedPullRequest({ merged: false, merged_at: null }),
        files: [],
        unifiedDiff: ""
      }),
    /not merged/
  );
});

test("rejects PRs not merged into main", () => {
  assert.throws(
    () =>
      createMigrationBundle({
        templateRepoFullName: "acme/template",
        pullRequest: mergedPullRequest({ base: { ref: "develop", repo: { full_name: "acme/template" } } }),
        files: [],
        unifiedDiff: ""
      }),
    /not main/
  );
});

test("rejects PRs from a different base repository", () => {
  assert.throws(
    () =>
      createMigrationBundle({
        templateRepoFullName: "acme/template",
        pullRequest: mergedPullRequest({ base: { ref: "main", repo: { full_name: "acme/other" } } }),
        files: [],
        unifiedDiff: ""
      }),
    /not acme\/template/
  );
});
