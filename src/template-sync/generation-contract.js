import fs from "node:fs";
import path from "node:path";
import { safeRelativePath, normalizeNewlines } from "./utils.js";

const EXECUTION_SENSITIVE_BASENAMES = new Set([
  ".npmrc",
  ".yarnrc",
  ".yarnrc.yml",
  "bun.lock",
  "bun.lockb",
  "npm-shrinkwrap.json",
  "package-lock.json",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "yarn.lock",
]);

export const GENERATION_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "rationale", "driftWarnings", "operations"],
  properties: {
    summary: { type: "string" },
    rationale: { type: "string" },
    driftWarnings: {
      type: "array",
      items: { type: "string" },
    },
    operations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action", "path", "content"],
        properties: {
          action: { type: "string", enum: ["create", "update", "delete"] },
          path: { type: "string" },
          content: { type: ["string", "null"] },
        },
      },
    },
  },
};

function isExecutionSensitiveGenerationPath(relativePath) {
  if (relativePath === ".github/workflows" || relativePath.startsWith(".github/workflows/")) {
    return true;
  }
  if (relativePath === ".github/actions" || relativePath.startsWith(".github/actions/")) {
    return true;
  }
  return EXECUTION_SENSITIVE_BASENAMES.has(path.posix.basename(relativePath));
}

function allowedPathSet(allowedPaths) {
  if (allowedPaths === undefined) {
    return null;
  }
  if (!Array.isArray(allowedPaths)) {
    throw new Error("allowedPaths must be an array when provided");
  }
  return new Set(allowedPaths.map((allowedPath) => safeRelativePath(allowedPath)));
}

function safeGenerationPath(filePath, allowedPaths) {
  const normalized = safeRelativePath(filePath);
  if (isExecutionSensitiveGenerationPath(normalized)) {
    throw new Error(`Refusing generated operation for execution-sensitive path: ${filePath}`);
  }
  if (allowedPaths && !allowedPaths.has(normalized)) {
    throw new Error(`Generated operation path is outside the migration bundle: ${filePath}`);
  }
  return normalized;
}

function resolveGenerationTarget(root, relativePath) {
  const rootPath = path.resolve(root);
  const target = path.resolve(rootPath, relativePath);
  const targetRelativePath = path.relative(rootPath, target);
  if (targetRelativePath.startsWith("..") || path.isAbsolute(targetRelativePath)) {
    throw new Error(`Generated operation target escaped repository root: ${relativePath}`);
  }
  return target;
}

function assertNoSymlinkPath(root, relativePath) {
  const segments = relativePath.split("/");
  let current = path.resolve(root);
  for (const segment of segments) {
    current = path.join(current, segment);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
      throw new Error(`Refusing generated operation through symlink path: ${relativePath}`);
    }
  }
}

export function parseGenerationJson(rawText) {
  const text = normalizeNewlines(rawText).trim();
  const fenced = text.match(/^```(?:json)?\n([\s\S]*)\n```$/);
  const jsonText = fenced ? fenced[1].trim() : text;
  return JSON.parse(jsonText);
}

export function validateGenerationPlan(plan, { allowedPaths } = {}) {
  const errors = [];
  let allowed;
  try {
    allowed = allowedPathSet(allowedPaths);
  } catch (error) {
    errors.push(error.message);
  }
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    throw new Error("Generation output must be a JSON object");
  }
  if (typeof plan.summary !== "string") {
    errors.push("summary must be a string");
  }
  if (!Array.isArray(plan.operations)) {
    errors.push("operations must be an array");
  } else {
    plan.operations.forEach((operation, index) => {
      if (!["create", "update", "delete"].includes(operation?.action)) {
        errors.push(`operations[${index}].action must be create, update, or delete`);
      }
      try {
        safeGenerationPath(operation?.path, allowed);
      } catch (error) {
        errors.push(`operations[${index}].path ${error.message}`);
      }
      if (operation?.action !== "delete" && typeof operation?.content !== "string") {
        errors.push(`operations[${index}].content must be a string for create/update`);
      }
      if (
        operation?.action === "delete" &&
        "content" in operation &&
        operation.content !== undefined &&
        operation.content !== null
      ) {
        errors.push(`operations[${index}].content must be null or omitted for delete`);
      }
    });
  }
  if (plan.driftWarnings !== undefined && !Array.isArray(plan.driftWarnings)) {
    errors.push("driftWarnings must be an array when present");
  }
  if (errors.length > 0) {
    throw new Error(`Malformed generation output: ${errors.join("; ")}`);
  }
  return {
    summary: plan.summary,
    rationale: plan.rationale || "",
    driftWarnings: plan.driftWarnings || [],
    operations: plan.operations.map((operation) => ({
      action: operation.action,
      path: safeGenerationPath(operation.path, allowed),
      content: operation.content ?? null,
    })),
  };
}

export function parseAndValidateGenerationPlan(rawText) {
  return validateGenerationPlan(parseGenerationJson(rawText));
}

export function applyGenerationPlan(plan, { root, allowedPaths } = {}) {
  const allowed = allowedPathSet(allowedPaths);
  const changedFiles = [];
  for (const operation of plan.operations) {
    const relativePath = safeGenerationPath(operation.path, allowed);
    const target = resolveGenerationTarget(root, relativePath);
    assertNoSymlinkPath(root, relativePath);
    if (operation.action === "delete") {
      if (fs.existsSync(target)) {
        fs.rmSync(target, { force: true });
        changedFiles.push(relativePath);
      }
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, operation.content, "utf8");
    changedFiles.push(relativePath);
  }
  return [...new Set(changedFiles)];
}
