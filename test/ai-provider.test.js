import test from "node:test";
import assert from "node:assert/strict";
import { resolveAiProviderConfig } from "../src/template-sync/ai-provider.js";

test("resolves provider-specific API keys and models", () => {
  assert.deepEqual(
    resolveAiProviderConfig({
      env: {
        TEMPLATE_SYNC_AI_PROVIDER: "gemini",
        GEMINI_API_KEY: "gemini-secret",
        GEMINI_MODEL: "gemini-custom",
      },
    }),
    {
      provider: "gemini",
      apiKey: "gemini-secret",
      apiKeyEnv: "GEMINI_API_KEY",
      model: "gemini-custom",
    },
  );

  assert.deepEqual(
    resolveAiProviderConfig({
      env: {
        TEMPLATE_SYNC_AI_PROVIDER: "anthropic",
        TEMPLATE_SYNC_AI_MODEL: "claude-custom",
        ANTHROPIC_API_KEY: "anthropic-secret",
      },
    }),
    {
      provider: "anthropic",
      apiKey: "anthropic-secret",
      apiKeyEnv: "ANTHROPIC_API_KEY",
      model: "claude-custom",
    },
  );
});

test("defaults to OpenAI and reports selected provider key", () => {
  assert.deepEqual(
    resolveAiProviderConfig({
      env: {
        OPENAI_API_KEY: "openai-secret",
        OPENAI_MODEL: "gpt-custom",
      },
    }),
    {
      provider: "openai",
      apiKey: "openai-secret",
      apiKeyEnv: "OPENAI_API_KEY",
      model: "gpt-custom",
    },
  );

  assert.throws(
    () => resolveAiProviderConfig({ env: { TEMPLATE_SYNC_AI_PROVIDER: "anthropic" } }),
    /Missing required environment variable: ANTHROPIC_API_KEY/,
  );
});
