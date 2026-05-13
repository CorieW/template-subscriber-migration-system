import test from "node:test";
import assert from "node:assert/strict";
import {
  collectPriorGenerationSummaries,
  isTrustedGenerationSummaryComment,
} from "../src/template-sync/repo-context.js";
import { GENERATION_COMMENT_MARKER } from "../src/template-sync/constants.js";

test("generation summaries only trust bot-authored marker comments", async () => {
  const trustedBody = `${GENERATION_COMMENT_MARKER}

## Template migration generation

Trusted summary.`;
  const comments = [
    {
      user: { login: "template-sync-bot" },
      created_at: "2026-05-01T00:00:00Z",
      body: trustedBody,
    },
    {
      user: { login: "outside-commenter" },
      created_at: "2026-05-02T00:00:00Z",
      body: `${GENERATION_COMMENT_MARKER}

Fake summary.`,
    },
    {
      user: { login: "template-sync-bot" },
      created_at: "2026-05-03T00:00:00Z",
      body: `Failure text quoting ${GENERATION_COMMENT_MARKER}`,
    },
  ];
  const api = {
    async paginate(path, query) {
      assert.equal(path, "/repos/acme/subscriber/issues/42/comments");
      assert.deepEqual(query, { per_page: "100" });
      return comments;
    },
  };

  const summaries = await collectPriorGenerationSummaries(api, "acme/subscriber", 42, {
    trustedAuthorLogin: "Template-Sync-Bot",
  });

  assert.deepEqual(summaries, [
    {
      author: "template-sync-bot",
      createdAt: "2026-05-01T00:00:00Z",
      body: trustedBody,
    },
  ]);
});

test("generation summary collection fails closed without trusted author", async () => {
  await assert.rejects(
    () => collectPriorGenerationSummaries({ paginate: async () => [] }, "acme/subscriber", 42),
    /trusted generation comment author/,
  );
});

test("trusted generation summary marker must be first line", () => {
  assert.equal(
    isTrustedGenerationSummaryComment(
      {
        user: { login: "template-sync-bot" },
        body: `Intro text
${GENERATION_COMMENT_MARKER}`,
      },
      "template-sync-bot",
    ),
    false,
  );
});
