import { MIGRATION_TAG_PREFIX } from "./constants.js";
import { normalizeNewlines } from "./utils.js";

export const TEMPLATE_SYNC_COMMANDS = Object.freeze(["approve", "revise", "decline"]);
export const ALLOWED_PERMISSIONS = Object.freeze(["write", "maintain", "admin"]);
export const TEMPLATE_MIGRATION_BRANCH_PREFIX = "template-migrations/";

export function parseTemplateSyncCommand(commentBody) {
  const normalized = normalizeNewlines(commentBody).trimEnd();
  const [firstLine = "", ...rest] = normalized.split("\n");
  const match = firstLine.trim().match(/^\/template-sync\s+(approve|revise|decline)(?:\s+(.+))?\s*$/);
  if (!match) {
    return null;
  }
  const inlineInstructions = match[2]?.trim() || "";
  const blockInstructions = rest.join("\n").trim();
  return {
    action: match[1],
    instructions: [inlineInstructions, blockInstructions].filter(Boolean).join("\n\n"),
  };
}

export function hasWritePermission(permission) {
  return ALLOWED_PERMISSIONS.includes(permission);
}

export function extractMigrationIdFromPr({ body = "", headRef = "" }) {
  const marker = String(body).match(/<!--\s*template-sync:migration-id=([^>\s]+)\s*-->/);
  if (marker?.[1]?.startsWith(MIGRATION_TAG_PREFIX)) {
    return marker[1];
  }
  if (headRef.startsWith(TEMPLATE_MIGRATION_BRANCH_PREFIX)) {
    const migrationId = headRef.slice(TEMPLATE_MIGRATION_BRANCH_PREFIX.length);
    if (migrationId.startsWith(MIGRATION_TAG_PREFIX)) {
      return migrationId;
    }
  }
  return null;
}

export function migrationBranchName(migrationId) {
  if (!migrationId?.startsWith(MIGRATION_TAG_PREFIX)) {
    throw new Error(`Invalid template migration id: ${migrationId || "<empty>"}`);
  }
  return `${TEMPLATE_MIGRATION_BRANCH_PREFIX}${migrationId}`;
}

export function assertTemplateMigrationPullRequest(pullRequest, repoFullName, migrationId) {
  const expectedBranch = migrationBranchName(migrationId);
  const headRepoFullName = pullRequest?.head?.repo?.full_name || "";
  const headRef = pullRequest?.head?.ref || "";
  if (headRepoFullName.toLowerCase() !== String(repoFullName || "").toLowerCase()) {
    throw new Error(
      `Template migration PR must be opened from ${repoFullName}, got ${headRepoFullName || "<unknown>"}`,
    );
  }
  if (headRef !== expectedBranch) {
    throw new Error(`Template migration PR head branch must be ${expectedBranch}, got ${headRef || "<unknown>"}`);
  }
}
