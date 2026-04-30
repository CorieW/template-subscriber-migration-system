import { MIGRATION_TAG_PREFIX } from "./constants.js";
import { normalizeNewlines } from "./utils.js";

export const TEMPLATE_SYNC_COMMANDS = Object.freeze(["approve", "revise", "decline"]);
export const ALLOWED_PERMISSIONS = Object.freeze(["write", "maintain", "admin"]);

export function parseTemplateSyncCommand(commentBody) {
  const normalized = normalizeNewlines(commentBody).trimEnd();
  const [firstLine = "", ...rest] = normalized.split("\n");
  const match = firstLine.trim().match(/^\/template-sync\s+(approve|revise|decline)\s*$/);
  if (!match) {
    return null;
  }
  return {
    action: match[1],
    instructions: rest.join("\n").trim()
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
  const branchPrefix = "template-migrations/";
  if (headRef.startsWith(branchPrefix)) {
    const migrationId = headRef.slice(branchPrefix.length);
    if (migrationId.startsWith(MIGRATION_TAG_PREFIX)) {
      return migrationId;
    }
  }
  return null;
}
