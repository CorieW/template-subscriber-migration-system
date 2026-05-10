#!/usr/bin/env node
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { GitHubApi } from "../src/template-sync/github-api.js";
import { MIGRATION_LABEL } from "../src/template-sync/constants.js";
import {
  parseTemplateSyncCommand,
  hasWritePermission,
  extractMigrationIdFromPr,
} from "../src/template-sync/commands.js";
import { downloadBundleAsset, getReleaseByTag } from "../src/template-sync/releases.js";
import { readRepoVariables, writeSubscriberStateTransition } from "../src/template-sync/repo-vars.js";
import { collectPriorGenerationSummaries, collectRepoContext } from "../src/template-sync/repo-context.js";
import { scoreDrift } from "../src/template-sync/drift.js";
import { buildGenerationPrompt, callOpenAiForGeneration } from "../src/template-sync/openai.js";
import { applyGenerationPlan, validateGenerationPlan } from "../src/template-sync/generation-contract.js";
import { refreshDependencies, runValidation } from "../src/template-sync/validation.js";
import { renderDeclineComment, renderGenerationComment } from "../src/template-sync/render.js";
import { parseRepo, requireEnv, uniqueSorted } from "../src/template-sync/utils.js";

function runGit(args, options = {}) {
  const output = execFileSync("git", args, {
    encoding: "utf8",
    stdio: options.stdio || ["ignore", "pipe", "pipe"],
    ...options,
  });
  return typeof output === "string" ? output.trim() : "";
}

function readEvent() {
  const eventPath = requireEnv("GITHUB_EVENT_PATH");
  return JSON.parse(fs.readFileSync(eventPath, "utf8"));
}

async function getCollaboratorPermission(api, repoFullName, username) {
  const repo = parseRepo(repoFullName);
  const result = await api.request(
    "GET",
    `/repos/${repo.owner}/${repo.repo}/collaborators/${encodeURIComponent(username)}/permission`,
  );
  return result.permission;
}

async function addIssueComment(api, repoFullName, issueNumber, body) {
  const repo = parseRepo(repoFullName);
  await api.request("POST", `/repos/${repo.owner}/${repo.repo}/issues/${issueNumber}/comments`, {
    body: { body },
  });
}

async function loadPullRequest(api, repoFullName, number) {
  const repo = parseRepo(repoFullName);
  return api.request("GET", `/repos/${repo.owner}/${repo.repo}/pulls/${number}`);
}

async function loadIssue(api, repoFullName, number) {
  const repo = parseRepo(repoFullName);
  return api.request("GET", `/repos/${repo.owner}/${repo.repo}/issues/${number}`);
}

function issueHasMigrationLabel(issue) {
  return (issue.labels || []).some((label) => (label.name || label) === MIGRATION_LABEL);
}

function checkoutPullRequestBranch({ repoFullName, pullRequest, botToken }) {
  runGit(["config", "user.name", "template-sync-bot"]);
  runGit(["config", "user.email", "template-sync-bot@users.noreply.github.com"]);
  if (botToken) {
    runGit(["remote", "set-url", "origin", `https://x-access-token:${botToken}@github.com/${repoFullName}.git`]);
  }
  runGit(["fetch", "origin", `${pullRequest.head.ref}:template-sync-worktree`], { stdio: "inherit" });
  runGit(["checkout", "template-sync-worktree"], { stdio: "inherit" });
}

function gitChangedFiles() {
  const output = runGit(["ls-files", "--modified", "--deleted", "--others", "--exclude-standard"]);
  return output ? output.split("\n").filter(Boolean) : [];
}

function commitAndPushIfNeeded({ pullRequest, migrationId, mode }) {
  const changedFiles = gitChangedFiles();
  if (changedFiles.length === 0) {
    return [];
  }
  runGit(["add", "--all"]);
  runGit(["commit", "-m", `${mode === "revise" ? "Revise" : "Apply"} template migration ${migrationId}`], {
    stdio: "inherit",
  });
  runGit(["push", "origin", `HEAD:${pullRequest.head.ref}`], { stdio: "inherit" });
  return changedFiles;
}

async function main() {
  const event = readEvent();
  const command = parseTemplateSyncCommand(event.comment?.body || "");
  if (!command) {
    console.log("No template-sync command found.");
    return;
  }
  if (!event.issue?.pull_request) {
    console.log("Template sync commands are only accepted on pull requests.");
    return;
  }

  const repoFullName = requireEnv("GITHUB_REPOSITORY");
  const botToken = requireEnv("TEMPLATE_SYNC_BOT_TOKEN");
  const api = new GitHubApi({ token: botToken });
  const issueNumber = event.issue.number;
  const commenter = event.comment.user.login;

  const permission = await getCollaboratorPermission(api, repoFullName, commenter);
  if (!hasWritePermission(permission)) {
    await addIssueComment(
      api,
      repoFullName,
      issueNumber,
      `@${commenter} does not have permission to run template sync commands.`,
    );
    throw new Error(`User ${commenter} has insufficient permission: ${permission}`);
  }

  const [issue, pullRequest] = await Promise.all([
    loadIssue(api, repoFullName, issueNumber),
    loadPullRequest(api, repoFullName, issueNumber),
  ]);
  if (!issueHasMigrationLabel(issue)) {
    console.log(`PR #${issueNumber} does not have the ${MIGRATION_LABEL} label.`);
    return;
  }

  const migrationId = extractMigrationIdFromPr({ body: pullRequest.body, headRef: pullRequest.head.ref });
  if (!migrationId) {
    throw new Error(`Could not map PR #${issueNumber} to a template migration id.`);
  }

  const state = await readRepoVariables(api, repoFullName);
  const upstreamRepoFullName = state.TEMPLATE_SYNC_UPSTREAM_REPO || requireEnv("TEMPLATE_SYNC_DEFAULT_UPSTREAM_REPO");
  const upstreamApi = new GitHubApi({
    token: process.env.TEMPLATE_SYNC_UPSTREAM_READ_TOKEN || botToken,
  });
  const release = await getReleaseByTag(upstreamApi, upstreamRepoFullName, migrationId);
  const bundle = await downloadBundleAsset(upstreamApi, upstreamRepoFullName, release);

  if (command.action === "decline") {
    const repo = parseRepo(repoFullName);
    await api.request("PATCH", `/repos/${repo.owner}/${repo.repo}/issues/${issueNumber}`, {
      body: { state: "closed" },
    });
    await writeSubscriberStateTransition(api, repoFullName, "declined", migrationId);
    await addIssueComment(api, repoFullName, issueNumber, renderDeclineComment(migrationId));
    console.log(`Declined ${migrationId}`);
    return;
  }

  const priorGenerationSummaries = await collectPriorGenerationSummaries(api, repoFullName, issueNumber);
  if (command.action === "revise" && priorGenerationSummaries.length === 0) {
    await addIssueComment(
      api,
      repoFullName,
      issueNumber,
      "Revision requested before any generation pass has completed.",
    );
    throw new Error("Cannot revise before initial generation.");
  }

  checkoutPullRequestBranch({ repoFullName, pullRequest, botToken });

  const root = process.cwd();
  const repoContext = collectRepoContext({ root, bundle });
  const drift = scoreDrift({ root, bundle });
  const prompt = buildGenerationPrompt({
    mode: command.action,
    bundle,
    repoContext,
    instructions: command.instructions,
    priorGenerationSummaries,
    drift,
  });
  const generationPlan = process.env.TEMPLATE_SYNC_GENERATION_MOCK_RESPONSE
    ? validateGenerationPlan(JSON.parse(process.env.TEMPLATE_SYNC_GENERATION_MOCK_RESPONSE))
    : await callOpenAiForGeneration({
        apiKey: requireEnv("OPENAI_API_KEY"),
        model: process.env.OPENAI_MODEL || "gpt-5.5",
        prompt,
      });

  const plannedChangedFiles = applyGenerationPlan(generationPlan, { root });
  const dependencyResults = await refreshDependencies({ root, changedFiles: plannedChangedFiles });
  const validationResults = [...dependencyResults, ...(await runValidation({ root }))];
  const changedFiles = uniqueSorted(gitChangedFiles());
  const failedValidationResults = validationResults.filter((result) => result.exitCode !== 0);

  if (failedValidationResults.length > 0) {
    await addIssueComment(
      api,
      repoFullName,
      issueNumber,
      renderGenerationComment({
        mode: command.action,
        instructions: command.instructions,
        changedFiles,
        validationResults,
        driftWarnings: [...drift.warnings, ...(generationPlan.driftWarnings || [])],
        summary: `${generationPlan.summary}\n\nValidation failed; subscriber state was not marked applied.`,
      }),
    );
    throw new Error(
      `Validation failed for ${migrationId}: ${failedValidationResults
        .map((result) => `${result.command} exited ${result.exitCode}`)
        .join("; ")}`,
    );
  }

  commitAndPushIfNeeded({ pullRequest, migrationId, mode: command.action });
  await writeSubscriberStateTransition(api, repoFullName, "applied", migrationId);
  await addIssueComment(
    api,
    repoFullName,
    issueNumber,
    renderGenerationComment({
      mode: command.action,
      instructions: command.instructions,
      changedFiles,
      validationResults,
      driftWarnings: [...drift.warnings, ...(generationPlan.driftWarnings || [])],
      summary: generationPlan.summary,
    }),
  );

  console.log(`${command.action} completed for ${migrationId}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
