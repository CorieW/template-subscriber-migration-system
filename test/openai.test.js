import test from "node:test";
import assert from "node:assert/strict";
import {
  callModelForGeneration,
  callModelForMigrationSummary,
  DEFAULT_OPENAI_RESPONSES_ENDPOINT_URL,
  modelEndpointConfigFromEnv,
} from "../src/template-sync/openai.js";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

test("posts generation requests to a configured model endpoint", async () => {
  let requestUrl;
  let requestInit;

  const plan = await callModelForGeneration({
    endpointUrl: "http://model.example/v1/template-sync",
    apiKey: "endpoint-secret",
    model: "custom-model",
    prompt: { mode: "approve" },
    fetchImpl: async (url, init) => {
      requestUrl = url;
      requestInit = init;
      return jsonResponse({
        summary: "Custom endpoint generated files",
        rationale: "Used model gateway",
        driftWarnings: [],
        operations: [{ action: "create", path: "src/app.ts", content: "export const value = 1;\n" }],
      });
    },
  });

  assert.equal(requestUrl, "http://model.example/v1/template-sync");
  assert.equal(requestInit.method, "POST");
  assert.equal(requestInit.headers.Authorization, "Bearer endpoint-secret");
  const body = JSON.parse(requestInit.body);
  assert.equal(body.model, "custom-model");
  assert.equal(body.input[0].role, "system");
  assert.deepEqual(JSON.parse(body.input[1].content), { mode: "approve" });
  assert.equal(body.text.format.name, "template_migration_file_operations");
  assert.deepEqual(plan.operations, [{ action: "create", path: "src/app.ts", content: "export const value = 1;\n" }]);
});

test("parses OpenAI response output text for migration summaries", async () => {
  let requestUrl;
  let requestInit;

  const summary = await callModelForMigrationSummary({
    apiKey: "openai-secret",
    model: "gpt-test",
    prompt: { migrationBundle: { migration: { id: "template-migration/pr-1-abc" } } },
    fetchImpl: async (url, init) => {
      requestUrl = url;
      requestInit = init;
      return jsonResponse({ output_text: JSON.stringify({ summary: "Updates app setup." }) });
    },
  });

  assert.equal(requestUrl, DEFAULT_OPENAI_RESPONSES_ENDPOINT_URL);
  assert.equal(requestInit.headers.Authorization, "Bearer openai-secret");
  assert.equal(summary.summary, "Updates app setup.");
});

test("model endpoint env keeps OpenAI keys off custom endpoints", () => {
  assert.deepEqual(
    modelEndpointConfigFromEnv({
      TEMPLATE_SYNC_MODEL_ENDPOINT_URL: "https://model.example/generate",
      TEMPLATE_SYNC_MODEL_API_KEY: "custom-secret",
      OPENAI_API_KEY: "openai-secret",
      OPENAI_MODEL: "custom-model",
    }),
    {
      endpointUrl: "https://model.example/generate",
      apiKey: "custom-secret",
      model: "custom-model",
    },
  );

  assert.deepEqual(
    modelEndpointConfigFromEnv({
      TEMPLATE_SYNC_MODEL_ENDPOINT_URL: "https://model.example/generate",
      OPENAI_API_KEY: "openai-secret",
    }),
    {
      endpointUrl: "https://model.example/generate",
      apiKey: "",
      model: "gpt-5.5",
    },
  );

  assert.deepEqual(modelEndpointConfigFromEnv({ OPENAI_API_KEY: "openai-secret" }), {
    endpointUrl: DEFAULT_OPENAI_RESPONSES_ENDPOINT_URL,
    apiKey: "openai-secret",
    model: "gpt-5.5",
  });
  assert.throws(() => modelEndpointConfigFromEnv({}), /OPENAI_API_KEY/);
});
