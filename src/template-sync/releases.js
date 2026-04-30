import { MIGRATION_BUNDLE_ASSET_NAME, MIGRATION_TAG_PREFIX } from "./constants.js";
import { parseRepo } from "./utils.js";
import { validateMigrationBundle } from "./bundle.js";

export function isMigrationRelease(release) {
  return Boolean(release?.tag_name?.startsWith(MIGRATION_TAG_PREFIX) && !release.draft && !release.prerelease);
}

export function selectNewestMigrationRelease(releases) {
  const candidates = releases.filter(isMigrationRelease);
  candidates.sort((a, b) => {
    const byPublishedAt = Date.parse(b.published_at || b.created_at || 0) - Date.parse(a.published_at || a.created_at || 0);
    if (byPublishedAt !== 0) {
      return byPublishedAt;
    }
    return String(b.tag_name).localeCompare(String(a.tag_name));
  });
  return candidates[0] || null;
}

export function renderReleaseBody(bundle) {
  return `${bundle.sourceSummary}

Source PR: ${bundle.sourcePullRequest.url}

This migration was published from a template PR merged into main.`;
}

export async function listTemplateMigrationReleases(api, upstreamRepoFullName) {
  const repo = parseRepo(upstreamRepoFullName);
  return api.paginate(`/repos/${repo.owner}/${repo.repo}/releases`, { per_page: "100" });
}

export async function getReleaseByTag(api, repoFullName, tagName) {
  const repo = parseRepo(repoFullName);
  return api.request("GET", `/repos/${repo.owner}/${repo.repo}/releases/tags/${encodeURIComponent(tagName)}`);
}

export async function downloadBundleAsset(api, upstreamRepoFullName, release) {
  const repo = parseRepo(upstreamRepoFullName);
  const assets = await api.request("GET", `/repos/${repo.owner}/${repo.repo}/releases/${release.id}/assets`);
  const asset = assets.find((candidate) => candidate.name === MIGRATION_BUNDLE_ASSET_NAME);
  if (!asset) {
    throw new Error(`Release ${release.tag_name} does not contain ${MIGRATION_BUNDLE_ASSET_NAME}`);
  }
  const text = await api.request("GET", `/repos/${repo.owner}/${repo.repo}/releases/assets/${asset.id}`, {
    accept: "application/octet-stream",
    raw: "text"
  });
  return validateMigrationBundle(JSON.parse(text));
}
