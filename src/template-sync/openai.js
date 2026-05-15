import { URL } from "node:url";
import { GENERATION_RESPONSE_SCHEMA, validateGenerationPlan } from "./generation-contract.js";
import { requireEnv, truncate } from "./utils.js";

export const DEFAULT_OPENAI_RESPONSES_ENDPOINT_URL = "https://api.openai.com/v1/responses";

export const MIGRATION_SUMMARY_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary"],
  properties: {
    summary: { type: "string" },
  },
};

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

function extractResponsesText(responseJson) {
  if (!responseJson || typeof responseJson !== "object") {
    return "";
  }
  if (typeof responseJson.output_text === "string") {
    return responseJson.output_text;
  }
  const parts = [];
  for (const item of responseJson.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }
  return parts.join("\n").trim();
}

function normalizeModelEndpointUrl(endpointUrl = DEFAULT_OPENAI_RESPONSES_ENDPOINT_URL) {
  const rawUrl = String(endpointUrl || DEFAULT_OPENAI_RESPONSES_ENDPOINT_URL).trim();
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Model endpoint URL is invalid: ${rawUrl}`);
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`Model endpoint URL must use http or https: ${rawUrl}`);
  }
  return url.toString();
}

function modelEndpointProviderName(endpointUrl) {
  return normalizeModelEndpointUrl(endpointUrl) === DEFAULT_OPENAI_RESPONSES_ENDPOINT_URL ? "OpenAI" : "Model endpoint";
}

function buildModelRequestHeaders(apiKey) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

function buildResponsesRequestBody({ model, systemPrompt, prompt, schemaName, schema }) {
  return {
    model,
    input: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: JSON.stringify(prompt),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: schemaName,
        strict: true,
        schema,
      },
    },
  };
}

function responseHasOpenAiOutputShape(responseJson) {
  return Boolean(
    responseJson && typeof responseJson === "object" && ("output_text" in responseJson || "output" in responseJson),
  );
}

function parseModelJsonOutput({ responseText, validateOutput, missingOutputMessage }) {
  const parsed = JSON.parse(responseText);
  const outputText = extractResponsesText(parsed);
  if (outputText) {
    return validateOutput(JSON.parse(outputText));
  }
  if (responseHasOpenAiOutputShape(parsed)) {
    throw new Error(missingOutputMessage);
  }
  return validateOutput(parsed);
}

function missingOutputMessage({ providerName, task }) {
  if (providerName === "OpenAI" && task === "migration summary") {
    return "OpenAI migration summary response did not contain output text";
  }
  if (providerName === "OpenAI" && task === "generation") {
    return "OpenAI response did not contain output text";
  }
  return `Model endpoint ${task} response did not contain output text or direct JSON output`;
}

async function callModelEndpoint({
  apiKey,
  model,
  prompt,
  systemPrompt,
  schemaName,
  schema,
  task,
  validateOutput,
  endpointUrl = DEFAULT_OPENAI_RESPONSES_ENDPOINT_URL,
  fetchImpl = globalThis.fetch,
}) {
  const url = normalizeModelEndpointUrl(endpointUrl);
  const providerName = modelEndpointProviderName(url);
  const response = await fetchImpl(url, {
    method: "POST",
    headers: buildModelRequestHeaders(apiKey),
    body: JSON.stringify(
      buildResponsesRequestBody({
        model,
        systemPrompt,
        prompt,
        schemaName,
        schema,
      }),
    ),
  });
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`${providerName} ${task} failed (${response.status}): ${responseText}`);
  }
  return parseModelJsonOutput({
    responseText,
    validateOutput,
    missingOutputMessage: missingOutputMessage({ providerName, task }),
  });
}

export function modelEndpointConfigFromEnv(env = process.env) {
  const endpointUrl = String(env.TEMPLATE_SYNC_MODEL_ENDPOINT_URL || "").trim();
  const apiKey = endpointUrl ? env.TEMPLATE_SYNC_MODEL_API_KEY || "" : requireEnv("OPENAI_API_KEY", env);
  return {
    endpointUrl: endpointUrl || DEFAULT_OPENAI_RESPONSES_ENDPOINT_URL,
    apiKey,
    model: env.OPENAI_MODEL || "gpt-5.5",
  };
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

export async function callModelForMigrationSummary(options) {
  return callModelEndpoint({
    ...options,
    task: "migration summary",
    systemPrompt:
      "You write concise migration summaries for template PRs. Summaries are reused across all subscriber repositories.",
    schemaName: "template_migration_summary",
    schema: MIGRATION_SUMMARY_RESPONSE_SCHEMA,
    validateOutput: validateMigrationSummaryOutput,
  });
}

export async function callOpenAiForMigrationSummary(options) {
  return callModelForMigrationSummary(options);
}

export async function callModelForGeneration(options) {
  return callModelEndpoint({
    ...options,
    task: "generation",
    systemPrompt:
      "You generate best-effort subscriber repository migrations from template PR bundles. You must return valid JSON file operations only.",
    schemaName: "template_migration_file_operations",
    schema: GENERATION_RESPONSE_SCHEMA,
    validateOutput: validateGenerationPlan,
  });
}

export async function callOpenAiForGeneration(options) {
  return callModelForGeneration(options);
}
