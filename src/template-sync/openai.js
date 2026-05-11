import { GENERATION_RESPONSE_SCHEMA, validateGenerationPlan } from "./generation-contract.js";
import { truncate } from "./utils.js";

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

export function buildGenerationPrompt({
  mode,
  bundle,
  repoContext,
  instructions,
  priorGenerationSummaries,
  drift,
  allowedOperationPaths,
}) {
  return {
    mode,
    contract: {
      description:
        "Return only JSON matching the provided schema. Use full file contents for every create/update operation. Do not return patches or markdown. Operation paths must be listed in allowedOperationPaths.",
      schema: GENERATION_RESPONSE_SCHEMA,
    },
    allowedOperationPaths: allowedOperationPaths || [],
    migrationBundle: bundle,
    subscriberRepoContext: repoContext,
    adminInstructions: instructions || "",
    priorGenerationSummaries: priorGenerationSummaries || [],
    drift,
  };
}

function extractResponsesText(responseJson) {
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

export async function callOpenAiForMigrationSummary({ apiKey, model, prompt, fetchImpl = globalThis.fetch }) {
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "You write concise migration summaries for template PRs. Summaries are reused across all subscriber repositories.",
        },
        {
          role: "user",
          content: JSON.stringify(prompt),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "template_migration_summary",
          strict: true,
          schema: MIGRATION_SUMMARY_RESPONSE_SCHEMA,
        },
      },
    }),
  });
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI migration summary failed (${response.status}): ${responseText}`);
  }
  const parsed = JSON.parse(responseText);
  const outputText = extractResponsesText(parsed);
  if (!outputText) {
    throw new Error("OpenAI migration summary response did not contain output text");
  }
  return validateMigrationSummaryOutput(JSON.parse(outputText));
}

export async function callOpenAiForGeneration({ apiKey, model, prompt, allowedPaths, fetchImpl = globalThis.fetch }) {
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "You generate best-effort subscriber repository migrations from template PR bundles. You must return valid JSON file operations only.",
        },
        {
          role: "user",
          content: JSON.stringify(prompt),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "template_migration_file_operations",
          strict: true,
          schema: GENERATION_RESPONSE_SCHEMA,
        },
      },
    }),
  });
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI generation failed (${response.status}): ${responseText}`);
  }
  const parsed = JSON.parse(responseText);
  const outputText = extractResponsesText(parsed);
  if (!outputText) {
    throw new Error("OpenAI response did not contain output text");
  }
  return validateGenerationPlan(JSON.parse(outputText), { allowedPaths });
}
