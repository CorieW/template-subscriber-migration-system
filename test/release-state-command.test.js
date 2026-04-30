import test from "node:test";
import assert from "node:assert/strict";
import { selectNewestMigrationRelease } from "../src/template-sync/releases.js";
import {
  applyStateTransition,
  blankSubscriberState,
  migrationMatchesHandledState
} from "../src/template-sync/repo-vars.js";
import { parseTemplateSyncCommand, hasWritePermission, extractMigrationIdFromPr } from "../src/template-sync/commands.js";
import { STATE_VARIABLES } from "../src/template-sync/constants.js";

test("selects only the newest template migration release", () => {
  const releases = [
    {
      tag_name: "template-migration/pr-1-aaaa",
      published_at: "2026-04-27T00:00:00Z",
      draft: false,
      prerelease: false
    },
    {
      tag_name: "unrelated/v1",
      published_at: "2026-04-29T00:00:00Z",
      draft: false,
      prerelease: false
    },
    {
      tag_name: "template-migration/pr-2-bbbb",
      published_at: "2026-04-28T00:00:00Z",
      draft: false,
      prerelease: false
    }
  ];

  assert.equal(selectNewestMigrationRelease(releases).tag_name, "template-migration/pr-2-bbbb");
});

test("older missed migrations are ignored when a newer release exists", () => {
  const state = blankSubscriberState();
  const releases = [
    {
      tag_name: "template-migration/pr-10-old",
      published_at: "2026-04-20T00:00:00Z",
      draft: false,
      prerelease: false
    },
    {
      tag_name: "template-migration/pr-11-new",
      published_at: "2026-04-29T00:00:00Z",
      draft: false,
      prerelease: false
    }
  ];

  const newest = selectNewestMigrationRelease(releases);
  assert.equal(newest.tag_name, "template-migration/pr-11-new");
  assert.equal(migrationMatchesHandledState(state, "template-migration/pr-10-old"), false);
});

test("state transitions record opened, applied, and declined migrations", () => {
  const opened = applyStateTransition(blankSubscriberState(), "opened", "template-migration/pr-1-a");
  assert.equal(opened[STATE_VARIABLES.lastHandled], "template-migration/pr-1-a");
  assert.equal(migrationMatchesHandledState(opened, "template-migration/pr-1-a"), true);

  const applied = applyStateTransition(opened, "applied", "template-migration/pr-1-a");
  assert.equal(applied[STATE_VARIABLES.lastApplied], "template-migration/pr-1-a");

  const declined = applyStateTransition(applied, "declined", "template-migration/pr-2-b");
  assert.equal(declined[STATE_VARIABLES.lastDeclined], "template-migration/pr-2-b");
  assert.equal(migrationMatchesHandledState(declined, "template-migration/pr-2-b"), true);
});

test("parses approve, revise, and decline commands with raw instructions", () => {
  assert.deepEqual(parseTemplateSyncCommand("/template-sync approve\nPrefer the existing router."), {
    action: "approve",
    instructions: "Prefer the existing router."
  });
  assert.deepEqual(parseTemplateSyncCommand("/template-sync revise\nUse a smaller helper."), {
    action: "revise",
    instructions: "Use a smaller helper."
  });
  assert.deepEqual(parseTemplateSyncCommand("/template-sync decline"), {
    action: "decline",
    instructions: ""
  });
  assert.equal(parseTemplateSyncCommand("/template-sync approve inline text"), null);
});

test("checks allowed commenter permissions", () => {
  assert.equal(hasWritePermission("read"), false);
  assert.equal(hasWritePermission("triage"), false);
  assert.equal(hasWritePermission("write"), true);
  assert.equal(hasWritePermission("maintain"), true);
  assert.equal(hasWritePermission("admin"), true);
});

test("extracts migration ids from PR marker or branch name", () => {
  assert.equal(
    extractMigrationIdFromPr({
      body: "<!-- template-sync:migration-id=template-migration/pr-5-abc -->",
      headRef: ""
    }),
    "template-migration/pr-5-abc"
  );
  assert.equal(
    extractMigrationIdFromPr({
      body: "",
      headRef: "template-migrations/template-migration/pr-6-def"
    }),
    "template-migration/pr-6-def"
  );
});
