import { GENERATION_RESPONSE_SCHEMA, validateGenerationPlan } from "./generation-contract.js";

export function buildGenerationPrompt({ mode, bundle, repoContext, instructions, priorGenerationSummaries, drift }) {
  return {
    mode,
    contract: {
      description:
        "Return only JSON matching the provided schema. Use full file contents for every create/update operation. Do not return patches or markdown.",
      schema: GENERATION_RESPONSE_SCHEMA
    },
    migrationBundle: bundle,
    subscriberRepoContext: repoContext,
    adminInstructions: instructions || "",
    priorGenerationSummaries: priorGenerationSummaries || [],
    drift
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

export async function callOpenAiForGeneration({ apiKey, model, prompt, fetchImpl = globalThis.fetch }) {
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "You generate best-effort subscriber repository migrations from template PR bundles. You must return valid JSON file operations only."
        },
        {
          role: "user",
          content: JSON.stringify(prompt)
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "template_migration_file_operations",
          strict: true,
          schema: GENERATION_RESPONSE_SCHEMA
        }
      }
    })
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
  return validateGenerationPlan(JSON.parse(outputText));
}
