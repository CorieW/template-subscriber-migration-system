import path from "node:path";

export function requireEnv(name, env = process.env) {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function parseRepo(repoFullName) {
  if (!repoFullName || !/^[^/\s]+\/[^/\s]+$/.test(repoFullName)) {
    throw new Error(`Expected repository as owner/name, got: ${repoFullName || "<empty>"}`);
  }
  const [owner, repo] = repoFullName.split("/");
  return { owner, repo, fullName: `${owner}/${repo}` };
}

export function shortSha(sha, length = 12) {
  if (!sha || typeof sha !== "string") {
    throw new Error("Expected a SHA string");
  }
  return sha.slice(0, length);
}

export function stripMarkdown(value) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[#>*_~|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(value, maxLength) {
  const text = String(value || "");
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 20))}\n...[truncated]`;
}

export function normalizeNewlines(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

export function safeRelativePath(filePath) {
  if (!filePath || typeof filePath !== "string") {
    throw new Error("File operation path must be a non-empty string");
  }
  if (filePath.includes("\0")) {
    throw new Error(`Unsafe file operation path: ${filePath}`);
  }
  const normalized = path.posix.normalize(filePath.replaceAll("\\", "/"));
  if (
    normalized === "." ||
    normalized.startsWith("../") ||
    normalized === ".." ||
    path.posix.isAbsolute(normalized) ||
    normalized === ".git" ||
    normalized.startsWith(".git/") ||
    normalized.includes("/.git/") ||
    normalized.endsWith("/.git")
  ) {
    throw new Error(`Unsafe file operation path: ${filePath}`);
  }
  return normalized;
}

export function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
