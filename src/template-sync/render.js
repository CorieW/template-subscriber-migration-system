import { GENERATION_COMMENT_MARKER } from "./constants.js";

function renderFileList(files) {
  if (!files?.length) {
    return "- No changed files were reported in the bundle.";
  }
  return files.map((file) => `- \`${file.filename}\` (${file.status})`).join("\n");
}

export function renderMigrationPrTitle(bundle) {
  return `Template migration: ${bundle.sourcePullRequest.title || bundle.migration.id}`;
}

export function renderMigrationPrBody(bundle) {
  return `<!-- template-sync:migration-id=${bundle.migration.id} -->

## Template Migration

${bundle.sourceSummary}

Source PR: ${bundle.sourcePullRequest.url}

The source PR was merged into \`main\` at ${bundle.sourcePullRequest.mergedAt} with merge SHA \`${bundle.sourcePullRequest.mergedSha}\`.

## Affected Files

${renderFileList(bundle.changedFiles)}

## Admin Commands

- \`/template-sync approve\`
- \`/template-sync approve\` followed by implementation instructions in the rest of the comment
- \`/template-sync revise\`
- \`/template-sync revise\` followed by revision instructions in the rest of the comment
- \`/template-sync decline\`

No code has been generated yet. This draft PR is waiting for an admin decision.`;
}

export function renderGenerationComment({ mode, instructions, changedFiles, validationResults, driftWarnings, summary }) {
  const title = mode === "revise" ? "Template migration revision" : "Template migration generation";
  const instructionText = instructions?.trim() || "No extra instructions were provided.";
  const files = changedFiles?.length ? changedFiles.map((file) => `- \`${file}\``).join("\n") : "- No file changes were produced.";
  const validation = validationResults?.length
    ? validationResults
        .map((result) => `- \`${result.command}\`: ${result.exitCode === 0 ? "passed" : `failed (${result.exitCode})`}`)
        .join("\n")
    : "- No validation commands were available.";
  const drift = driftWarnings?.length ? driftWarnings.map((warning) => `- ${warning}`).join("\n") : "- No drift warnings were reported.";

  return `${GENERATION_COMMENT_MARKER}

## ${title}

${summary || "The migration branch was updated from the structured generation output."}

Instructions used:

${instructionText}

Files changed:

${files}

Validation:

${validation}

Drift and risk notes:

${drift}`;
}

export function renderDeclineComment(migrationId) {
  return `Template migration \`${migrationId}\` was declined and the subscriber state was updated.`;
}
