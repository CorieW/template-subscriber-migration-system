import { MIGRATION_TAG_PREFIX } from "./constants.js";
import { shortSha, stripMarkdown, truncate } from "./utils.js";

export function deriveMigrationIdFromPullRequest(pullRequest) {
  if (!pullRequest?.number || !pullRequest?.merge_commit_sha) {
    throw new Error("Merged pull request number and merge_commit_sha are required");
  }
  return `${MIGRATION_TAG_PREFIX}pr-${pullRequest.number}-${shortSha(pullRequest.merge_commit_sha)}`;
}

export function assertPublishablePullRequest(pullRequest, templateRepoFullName) {
  if (!pullRequest) {
    throw new Error("Pull request was not found");
  }
  if (pullRequest.base?.repo?.full_name !== templateRepoFullName) {
    throw new Error(
      `PR #${pullRequest.number} belongs to ${pullRequest.base?.repo?.full_name || "<unknown>"}, not ${templateRepoFullName}`
    );
  }
  if (pullRequest.base?.ref !== "main") {
    throw new Error(`PR #${pullRequest.number} targets ${pullRequest.base?.ref || "<unknown>"}, not main`);
  }
  if (!pullRequest.merged || !pullRequest.merged_at) {
    throw new Error(`PR #${pullRequest.number} is not merged`);
  }
  if (!pullRequest.merge_commit_sha) {
    throw new Error(`PR #${pullRequest.number} has no merge commit SHA`);
  }
}

export function subscriberSummaryFromPullRequest(pullRequest) {
  const title = String(pullRequest.title || `PR #${pullRequest.number}`);
  const bodySummary = stripMarkdown(pullRequest.body || "");
  if (!bodySummary) {
    return title;
  }
  return truncate(`${title}\n\n${bodySummary}`, 900);
}

export function normalizeChangedFiles(files) {
  return [...files]
    .sort((a, b) => String(a.filename).localeCompare(String(b.filename)))
    .map((file) => ({
      filename: file.filename,
      previousFilename: file.previous_filename || null,
      status: file.status,
      additions: Number(file.additions || 0),
      deletions: Number(file.deletions || 0),
      changes: Number(file.changes || 0)
    }));
}

export function createMigrationBundle({ templateRepoFullName, pullRequest, files, unifiedDiff }) {
  assertPublishablePullRequest(pullRequest, templateRepoFullName);
  const migrationId = deriveMigrationIdFromPullRequest(pullRequest);
  return {
    schemaVersion: "template-migration-bundle/v1",
    templateRepository: {
      fullName: templateRepoFullName,
      branch: "main"
    },
    migration: {
      id: migrationId
    },
    sourcePullRequest: {
      number: pullRequest.number,
      url: pullRequest.html_url,
      title: pullRequest.title || "",
      body: pullRequest.body || "",
      labels: (pullRequest.labels || []).map((label) => label.name || label).filter(Boolean),
      mergedSha: pullRequest.merge_commit_sha,
      mergedAt: pullRequest.merged_at,
      mergedInto: "main"
    },
    sourceSummary: subscriberSummaryFromPullRequest(pullRequest),
    changedFiles: normalizeChangedFiles(files || []),
    unifiedDiff: String(unifiedDiff || "")
  };
}

export function validateMigrationBundle(bundle) {
  const errors = [];
  if (bundle?.schemaVersion !== "template-migration-bundle/v1") {
    errors.push("schemaVersion must be template-migration-bundle/v1");
  }
  if (!bundle?.templateRepository?.fullName) {
    errors.push("templateRepository.fullName is required");
  }
  if (bundle?.templateRepository?.branch !== "main") {
    errors.push("templateRepository.branch must be main");
  }
  if (!bundle?.migration?.id?.startsWith(MIGRATION_TAG_PREFIX)) {
    errors.push(`migration.id must start with ${MIGRATION_TAG_PREFIX}`);
  }
  if (bundle?.sourcePullRequest?.mergedInto !== "main") {
    errors.push("sourcePullRequest.mergedInto must be main");
  }
  if (!bundle?.sourcePullRequest?.mergedSha) {
    errors.push("sourcePullRequest.mergedSha is required");
  }
  if (!Array.isArray(bundle?.changedFiles)) {
    errors.push("changedFiles must be an array");
  }
  if (typeof bundle?.unifiedDiff !== "string") {
    errors.push("unifiedDiff must be a string");
  }
  if (errors.length > 0) {
    throw new Error(`Invalid migration bundle: ${errors.join("; ")}`);
  }
  return bundle;
}
