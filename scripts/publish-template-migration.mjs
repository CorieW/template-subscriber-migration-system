#!/usr/bin/env node
import fs from "node:fs";
import { GitHubApi } from "../src/template-sync/github-api.js";
import { createMigrationBundle } from "../src/template-sync/bundle.js";
import { MIGRATION_BUNDLE_ASSET_NAME } from "../src/template-sync/constants.js";
import { renderReleaseBody } from "../src/template-sync/releases.js";
import { parseRepo, requireEnv } from "../src/template-sync/utils.js";

async function main() {
  const repoFullName = requireEnv("GITHUB_REPOSITORY");
  const token = requireEnv("GITHUB_TOKEN");
  const prNumber = process.argv[2] || process.env.PR_NUMBER || process.env.INPUT_PR_NUMBER;
  if (!prNumber || !/^\d+$/.test(String(prNumber))) {
    throw new Error("Usage: publish-template-migration.mjs <pull-request-number>");
  }

  const repo = parseRepo(repoFullName);
  const api = new GitHubApi({ token });

  const pullRequest = await api.request("GET", `/repos/${repo.owner}/${repo.repo}/pulls/${prNumber}`);
  const files = await api.paginate(`/repos/${repo.owner}/${repo.repo}/pulls/${prNumber}/files`, { per_page: "100" });
  const unifiedDiff = await api.request("GET", `/repos/${repo.owner}/${repo.repo}/pulls/${prNumber}`, {
    accept: "application/vnd.github.v3.patch",
    raw: "text"
  });

  const bundle = createMigrationBundle({
    templateRepoFullName: repoFullName,
    pullRequest,
    files,
    unifiedDiff
  });
  const bundleJson = `${JSON.stringify(bundle, null, 2)}\n`;
  fs.writeFileSync(MIGRATION_BUNDLE_ASSET_NAME, bundleJson, "utf8");

  const release = await api.request("POST", `/repos/${repo.owner}/${repo.repo}/releases`, {
    body: {
      tag_name: bundle.migration.id,
      target_commitish: "main",
      name: bundle.migration.id,
      body: renderReleaseBody(bundle),
      draft: false,
      prerelease: false
    }
  });

  await api.uploadAsset(release.upload_url, MIGRATION_BUNDLE_ASSET_NAME, Buffer.from(bundleJson, "utf8"));

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `migration_id=${bundle.migration.id}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `release_url=${release.html_url}\n`);
  }

  console.log(`Published ${bundle.migration.id}`);
  console.log(release.html_url);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
