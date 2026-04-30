export const MIGRATION_TAG_PREFIX = "template-migration/";
export const MIGRATION_BUNDLE_ASSET_NAME = "migration-bundle.json";
export const MIGRATION_LABEL = "template-migration";

export const STATE_VARIABLES = Object.freeze({
  lastHandled: "TEMPLATE_SYNC_LAST_HANDLED_MIGRATION_ID",
  lastApplied: "TEMPLATE_SYNC_LAST_APPLIED_MIGRATION_ID",
  lastDeclined: "TEMPLATE_SYNC_LAST_DECLINED_MIGRATION_ID",
  upstreamRepo: "TEMPLATE_SYNC_UPSTREAM_REPO"
});

export const GENERATION_COMMENT_MARKER = "<!-- template-sync:generation-summary -->";

export const KNOWN_CONFIG_FILES = Object.freeze([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "package-lock.json",
  "yarn.lock",
  "tsconfig.json",
  "tsconfig.base.json",
  "vite.config.js",
  "vite.config.ts",
  "next.config.js",
  "next.config.mjs",
  "eslint.config.js",
  "eslint.config.mjs",
  ".eslintrc",
  ".eslintrc.json",
  ".prettierrc",
  ".prettierrc.json"
]);
