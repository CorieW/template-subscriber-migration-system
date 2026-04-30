import fs from "node:fs";
import path from "node:path";
import { KNOWN_CONFIG_FILES, GENERATION_COMMENT_MARKER } from "./constants.js";
import { safeRelativePath, truncate, uniqueSorted } from "./utils.js";

const MAX_CONTEXT_FILE_LENGTH = 120_000;

function readFileIfPresent(root, relativePath) {
  const safePath = safeRelativePath(relativePath);
  const target = path.join(root, safePath);
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    return { path: safePath, exists: false, content: "" };
  }
  return {
    path: safePath,
    exists: true,
    content: truncate(fs.readFileSync(target, "utf8"), MAX_CONTEXT_FILE_LENGTH)
  };
}

export function affectedBundlePaths(bundle) {
  return uniqueSorted(
    (bundle.changedFiles || []).flatMap((file) => [file.filename, file.previousFilename].filter(Boolean))
  );
}

export function collectRepoContext({ root, bundle }) {
  const affectedPaths = affectedBundlePaths(bundle);
  const configPaths = KNOWN_CONFIG_FILES.filter((file) => fs.existsSync(path.join(root, file)));
  return {
    affectedFiles: affectedPaths.map((file) => readFileIfPresent(root, file)),
    configFiles: configPaths.map((file) => readFileIfPresent(root, file))
  };
}

export async function collectPriorGenerationSummaries(api, repoFullName, issueNumber) {
  const [owner, repo] = repoFullName.split("/");
  const comments = await api.paginate(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, { per_page: "100" });
  return comments
    .filter((comment) => String(comment.body || "").includes(GENERATION_COMMENT_MARKER))
    .map((comment) => ({
      author: comment.user?.login || "",
      createdAt: comment.created_at,
      body: comment.body
    }));
}
