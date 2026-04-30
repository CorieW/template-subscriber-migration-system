import fs from "node:fs";
import path from "node:path";
import { safeRelativePath, normalizeNewlines } from "./utils.js";

export const GENERATION_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "rationale", "driftWarnings", "operations"],
  properties: {
    summary: { type: "string" },
    rationale: { type: "string" },
    driftWarnings: {
      type: "array",
      items: { type: "string" }
    },
    operations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action", "path"],
        properties: {
          action: { type: "string", enum: ["create", "update", "delete"] },
          path: { type: "string" },
          content: { type: "string" }
        }
      }
    }
  }
};

export function parseGenerationJson(rawText) {
  const text = normalizeNewlines(rawText).trim();
  const fenced = text.match(/^```(?:json)?\n([\s\S]*)\n```$/);
  const jsonText = fenced ? fenced[1].trim() : text;
  return JSON.parse(jsonText);
}

export function validateGenerationPlan(plan) {
  const errors = [];
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
        safeRelativePath(operation?.path);
      } catch (error) {
        errors.push(`operations[${index}].path ${error.message}`);
      }
      if (operation?.action !== "delete" && typeof operation?.content !== "string") {
        errors.push(`operations[${index}].content must be a string for create/update`);
      }
      if (operation?.action === "delete" && "content" in operation && operation.content !== undefined) {
        errors.push(`operations[${index}].content must be omitted for delete`);
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
      path: safeRelativePath(operation.path),
      content: operation.content
    }))
  };
}

export function parseAndValidateGenerationPlan(rawText) {
  return validateGenerationPlan(parseGenerationJson(rawText));
}

export function applyGenerationPlan(plan, { root }) {
  const changedFiles = [];
  for (const operation of plan.operations) {
    const relativePath = safeRelativePath(operation.path);
    const target = path.join(root, relativePath);
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
