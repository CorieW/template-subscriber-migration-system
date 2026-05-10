import test from "node:test";
import assert from "node:assert/strict";
import { renderCommandFailureComment } from "../src/template-sync/render.js";

test("renders command failure comments for configuration errors", () => {
  const body = renderCommandFailureComment({
    action: "approve",
    errorMessage: "Missing required environment variable: OPENAI_API_KEY",
  });

  assert.match(body, /Template migration command failed/);
  assert.match(body, /`\/template-sync approve` command could not complete/);
  assert.match(body, /Missing required environment variable: OPENAI_API_KEY/);
  assert.match(body, /comment `\/template-sync approve` again/);
});

test("escapes code fences in command failure comments", () => {
  const body = renderCommandFailureComment({
    action: "revise",
    errorMessage: "bad ``` fence",
  });

  assert.doesNotMatch(body, /bad ``` fence/);
  assert.match(body, /bad ` ` ` fence/);
});
