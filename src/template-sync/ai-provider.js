import { genkit, z } from "genkit";
import { anthropic } from "@genkit-ai/anthropic";
import { openAI } from "@genkit-ai/compat-oai/openai";
import { googleAI } from "@genkit-ai/google-genai";
import { GENERATION_RESPONSE_SCHEMA, validateGenerationPlan } from "./generation-contract.js";
import { requireEnv, truncate } from "./utils.js";

export const AI_PROVIDERS = Object.freeze({
  openai: {
    apiKeyEnv: "OPENAI_API_KEY",
    defaultModel: "gpt-5.5",
    modelEnv: "OPENAI_MODEL",
  },
  gemini: {
    apiKeyEnv: "GEMINI_API_KEY",
    defaultModel: "gemini-2.5-flash",
    modelEnv: "GEMINI_MODEL",
  },
  anthropic: {
    apiKeyEnv: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-4-5",
    modelEnv: "ANTHROPIC_MODEL",
  },
});

export const MIGRATION_SUMMARY_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary"],
  properties: {
    summary: { type: "string" },
  },
};

const MIGRATION_SUMMARY_OUTPUT_SCHEMA = z.object({
  summary: z.string().describe("Concise reusable summary for subscriber migration PRs."),
});

const GENERATION_OPERATION_OUTPUT_SCHEMA = z.object({
  action: z.enum(["create", "update", "delete"]),
  path: z.string().describe("Repo-relative file path."),
  content: z
    .string()
    .nullable()
    .describe("Full file content for create/update operations. Use null for delete operations."),
});

const GENERATION_OUTPUT_SCHEMA = z.object({
  summary: z.string(),
  rationale: z.string(),
  driftWarnings: z.array(z.string()),
  operations: z.array(GENERATION_OPERATION_OUTPUT_SCHEMA),
});

const MAX_MIGRATION_SUMMARY_LENGTH = 2000;

export function buildMigrationSummaryPrompt({ bundle }) {
  return {
    contract: {
      description:
        "Return only JSON matching the provided schema. Summarize the template change once for all subscriber repositories.",
      schema: MIGRATION_SUMMARY_RESPONSE_SCHEMA,
    },
    migrationBundle: bundle,
  };
}

export function buildGenerationPrompt({ mode, bundle, repoContext, instructions, priorGenerationSummaries, drift }) {
  return {
    mode,
    contract: {
      description:
        "Return only JSON matching the provided schema. Use full file contents for every create/update operation. Do not return patches or markdown.",
      schema: GENERATION_RESPONSE_SCHEMA,
    },
    migrationBundle: bundle,
    subscriberRepoContext: repoContext,
    adminInstructions: instructions || "",
    priorGenerationSummaries: priorGenerationSummaries || [],
    drift,
  };
}

function normalizeAiProvider(provider) {
  const normalized = String(provider || "openai").toLowerCase();
  if (normalized === "google" || normalized === "googleai" || normalized === "google-ai") {
    return "gemini";
  }
  if (!AI_PROVIDERS[normalized]) {
    throw new Error(`Unsupported TEMPLATE_SYNC_AI_PROVIDER: ${provider}`);
  }
  return normalized;
}

export function resolveAiProviderConfig({ env = process.env, provider = env.TEMPLATE_SYNC_AI_PROVIDER } = {}) {
  const normalizedProvider = normalizeAiProvider(provider);
  const providerConfig = AI_PROVIDERS[normalizedProvider];
  return {
    provider: normalizedProvider,
    apiKey: requireEnv(providerConfig.apiKeyEnv, env),
    apiKeyEnv: providerConfig.apiKeyEnv,
    model: env.TEMPLATE_SYNC_AI_MODEL || env[providerConfig.modelEnv] || providerConfig.defaultModel,
  };
}

function createProviderRuntime({ provider, apiKey, model }) {
  if (provider === "openai") {
    return {
      plugins: [openAI({ apiKey })],
      model: openAI.model(model),
    };
  }
  if (provider === "gemini") {
    return {
      plugins: [googleAI({ apiKey })],
      model: googleAI.model(model),
    };
  }
  if (provider === "anthropic") {
    return {
      plugins: [anthropic({ apiKey, apiVersion: "beta" })],
      model: anthropic.model(model, { apiVersion: "beta" }),
    };
  }
  throw new Error(`Unsupported AI provider: ${provider}`);
}

function parseStructuredOutput(response) {
  if (response.output !== null && response.output !== undefined) {
    return response.output;
  }
  if (response.text) {
    return JSON.parse(response.text);
  }
  throw new Error("AI provider response did not contain structured output");
}

async function callAiForStructuredOutput({ providerConfig, system, prompt, schema }) {
  const runtime = createProviderRuntime(providerConfig);
  const ai = genkit({ plugins: runtime.plugins, promptDir: null });
  const response = await ai.generate({
    model: runtime.model,
    system,
    prompt: JSON.stringify(prompt),
    output: { schema, format: "json", constrained: true },
  });
  return parseStructuredOutput(response);
}

export function validateMigrationSummaryOutput(output) {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    throw new Error("Migration summary output must be a JSON object");
  }
  if (typeof output.summary !== "string" || !output.summary.trim()) {
    throw new Error("Migration summary output summary must be a non-empty string");
  }
  return {
    summary: truncate(output.summary.trim(), MAX_MIGRATION_SUMMARY_LENGTH),
  };
}

export async function callAiForMigrationSummary({ providerConfig, prompt }) {
  const output = await callAiForStructuredOutput({
    providerConfig,
    system:
      "You write concise migration summaries for template PRs. Summaries are reused across all subscriber repositories.",
    prompt,
    schema: MIGRATION_SUMMARY_OUTPUT_SCHEMA,
  });
  return validateMigrationSummaryOutput(output);
}

export async function callAiForGeneration({ providerConfig, prompt }) {
  const output = await callAiForStructuredOutput({
    providerConfig,
    system:
      "You generate best-effort subscriber repository migrations from template PR bundles. You must return valid JSON file operations only.",
    prompt,
    schema: GENERATION_OUTPUT_SCHEMA,
  });
  return validateGenerationPlan(output);
}
