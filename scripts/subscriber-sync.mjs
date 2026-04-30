#!/usr/bin/env node
import { GitHubApi } from "../src/template-sync/github-api.js";
import { MIGRATION_LABEL } from "../src/template-sync/constants.js";
import { downloadBundleAsset, listTemplateMigrationReleases, selectNewestMigrationRelease } from "../src/template-sync/releases.js";
import { renderMigrationPrBody, renderMigrationPrTitle } from "../src/template-sync/render.js";
import {
  migrationMatchesHandledState,
  readRepoVariables,
  writeSubscriberStateTransition
} from "../src/template-sync/repo-vars.js";
import { parseRepo, requireEnv } from "../src/template-sync/utils.js";

async function getDefaultBranch(api, repoFullName) {
  const repo = parseRepo(repoFullName);
  const repository = await api.request("GET", `/repos/${repo.owner}/${repo.repo}`);
  return repository.default_branch || "main";
}

async function getBranchSha(api, repoFullName, branchName) {
  const repo = parseRepo(repoFullName);
  const ref = await api.request("GET", `/repos/${repo.owner}/${repo.repo}/git/ref/heads/${branchName}`);
  return ref.object.sha;
}

async function ensureBranch(api, repoFullName, branchName, sha) {
  const repo = parseRepo(repoFullName);
  try {
    await api.request("GET", `/repos/${repo.owner}/${repo.repo}/git/ref/heads/${branchName}`);
    return "existing";
  } catch (error) {
    if (error.status !== 404) {
      throw error;
    }
  }
  await api.request("POST", `/repos/${repo.owner}/${repo.repo}/git/refs`, {
    body: {
      ref: `refs/heads/${branchName}`,
      sha
    }
  });
  return "created";
}

async function findOpenMigrationPullRequest(api, repoFullName) {
  const repo = parseRepo(repoFullName);
  const issues = await api.paginate(`/repos/${repo.owner}/${repo.repo}/issues`, {
    state: "open",
    labels: MIGRATION_LABEL,
    per_page: "100"
  });
  return issues.find((issue) => issue.pull_request) || null;
}

async function ensureMigrationLabel(api, repoFullName) {
  const repo = parseRepo(repoFullName);
  try {
    await api.request("GET", `/repos/${repo.owner}/${repo.repo}/labels/${encodeURIComponent(MIGRATION_LABEL)}`);
  } catch (error) {
    if (error.status !== 404) {
      throw error;
    }
    await api.request("POST", `/repos/${repo.owner}/${repo.repo}/labels`, {
      body: {
        name: MIGRATION_LABEL,
        color: "0969da",
        description: "Template subscriber migration"
      }
    });
  }
}

async function main() {
  const subscriberRepoFullName = requireEnv("GITHUB_REPOSITORY");
  const botToken = requireEnv("TEMPLATE_SYNC_BOT_TOKEN");
  const defaultUpstreamRepo = requireEnv("TEMPLATE_SYNC_DEFAULT_UPSTREAM_REPO");
  const forceReprocess = process.env.GITHUB_EVENT_NAME === "workflow_dispatch";

  const subscriberApi = new GitHubApi({ token: botToken });
  const state = await readRepoVariables(subscriberApi, subscriberRepoFullName);
  const upstreamRepoFullName = state.TEMPLATE_SYNC_UPSTREAM_REPO || defaultUpstreamRepo;
  const upstreamApi = new GitHubApi({
    token: process.env.TEMPLATE_SYNC_UPSTREAM_READ_TOKEN || botToken
  });

  const releases = await listTemplateMigrationReleases(upstreamApi, upstreamRepoFullName);
  const newest = selectNewestMigrationRelease(releases);
  if (!newest) {
    console.log("No template migration releases found.");
    return;
  }

  if (!forceReprocess && migrationMatchesHandledState(state, newest.tag_name)) {
    console.log(`Newest migration ${newest.tag_name} is already handled.`);
    return;
  }

  const openMigrationPullRequest = await findOpenMigrationPullRequest(subscriberApi, subscriberRepoFullName);
  if (openMigrationPullRequest) {
    console.log(`Open template migration PR already exists: #${openMigrationPullRequest.number}`);
    return;
  }

  const bundle = await downloadBundleAsset(upstreamApi, upstreamRepoFullName, newest);
  const defaultBranch = await getDefaultBranch(subscriberApi, subscriberRepoFullName);
  const baseSha = await getBranchSha(subscriberApi, subscriberRepoFullName, defaultBranch);
  const branchName = `template-migrations/${bundle.migration.id}`;
  await ensureBranch(subscriberApi, subscriberRepoFullName, branchName, baseSha);

  const repo = parseRepo(subscriberRepoFullName);
  const pullRequest = await subscriberApi.request("POST", `/repos/${repo.owner}/${repo.repo}/pulls`, {
    body: {
      title: renderMigrationPrTitle(bundle),
      head: branchName,
      base: defaultBranch,
      body: renderMigrationPrBody(bundle),
      draft: true,
      maintainer_can_modify: true
    }
  });

  await ensureMigrationLabel(subscriberApi, subscriberRepoFullName);
  await subscriberApi.request("POST", `/repos/${repo.owner}/${repo.repo}/issues/${pullRequest.number}/labels`, {
    body: {
      labels: [MIGRATION_LABEL]
    }
  });
  await writeSubscriberStateTransition(subscriberApi, subscriberRepoFullName, "opened", bundle.migration.id);

  console.log(`Opened draft template migration PR #${pullRequest.number} for ${bundle.migration.id}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
