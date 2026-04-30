import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("publish workflow is manual only and publishes PR-scoped release assets", () => {
  const workflow = read(".github/workflows/template-publish-migration.yml");
  const script = read("scripts/publish-template-migration.mjs");
  const constants = read("src/template-sync/constants.js");

  assert.match(workflow, /workflow_dispatch/);
  assert.doesNotMatch(workflow, /^\s*push:/m);
  assert.doesNotMatch(workflow, /^\s*pull_request:/m);
  assert.match(workflow, /contents: write/);
  assert.match(script, /createMigrationBundle/);
  assert.match(script, /releases/);
  assert.match(constants, /migration-bundle\.json/);
  assert.match(script, /application\/vnd\.github\.v3\.patch/);
});

test("subscriber sync workflow polls newest release and opens at most one draft PR", () => {
  const workflow = read(".github/workflows/template-sync.yml");
  const script = read("scripts/subscriber-sync.mjs");

  assert.match(workflow, /schedule:/);
  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /secrets\.TEMPLATE_SYNC_BOT_TOKEN/);
  assert.match(script, /selectNewestMigrationRelease/);
  assert.match(script, /migrationMatchesHandledState/);
  assert.match(script, /findOpenMigrationPullRequest/);
  assert.match(script, /draft: true/);
  assert.match(script, /writeSubscriberStateTransition\(subscriberApi, subscriberRepoFullName, "opened"/);
});

test("comment workflow supports approve revise decline with bot-token pushes", () => {
  const workflow = read(".github/workflows/template-migration-command.yml");
  const script = read("scripts/handle-template-sync-command.mjs");

  assert.match(workflow, /issue_comment/);
  assert.match(workflow, /template-migration-\$\{\{ github\.event\.issue\.number \}\}/);
  assert.match(workflow, /token: \$\{\{ secrets\.TEMPLATE_SYNC_BOT_TOKEN \}\}/);
  assert.match(workflow, /OPENAI_API_KEY/);
  assert.match(script, /parseTemplateSyncCommand/);
  assert.match(script, /hasWritePermission/);
  assert.match(script, /writeSubscriberStateTransition\(api, repoFullName, "declined"/);
  assert.match(script, /writeSubscriberStateTransition\(api, repoFullName, "applied"/);
  assert.match(script, /x-access-token:\$\{botToken\}/);
  assert.match(script, /push", "origin", `HEAD:\$\{pullRequest\.head\.ref\}`/);
});
