---
title: Commands
description: Package binary command reference with examples.
---

## `publish-template-migration`

Publishes a migration bundle release from a merged template PR.

```sh
publish-template-migration 123
```

Environment:

| Name                                  | Required                                             | Description                                                                                      |
| ------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `GITHUB_REPOSITORY`                   | Yes                                                  | Template repository in `OWNER/REPO` form.                                                        |
| `GITHUB_TOKEN`                        | Yes                                                  | Token with release write access and PR read access.                                              |
| `TEMPLATE_SYNC_GENERATE_SUMMARY`      | No                                                   | Set to `true`, `1`, `yes`, or `on` to generate one reusable migration summary during publishing. |
| `OPENAI_API_KEY`                      | Yes when `TEMPLATE_SYNC_GENERATE_SUMMARY` is enabled | API key for summary generation.                                                                  |
| `OPENAI_MODEL`                        | No                                                   | Summary model. Defaults to `gpt-5.5`.                                                            |
| `TEMPLATE_SYNC_SUMMARY_MOCK_RESPONSE` | No                                                   | JSON summary response used for local or test runs instead of OpenAI.                             |

## `subscriber-template-sync`

Discovers the newest migration and opens a draft PR in a subscriber repository.

```sh
subscriber-template-sync
```

Environment:

| Name                                  | Required | Description                                       |
| ------------------------------------- | -------- | ------------------------------------------------- |
| `GITHUB_REPOSITORY`                   | Yes      | Subscriber repository in `OWNER/REPO` form.       |
| `TEMPLATE_SYNC_BOT_TOKEN`             | Yes      | Bot token for subscriber repository writes.       |
| `TEMPLATE_SYNC_DEFAULT_UPSTREAM_REPO` | Yes      | Default template repository in `OWNER/REPO` form. |
| `TEMPLATE_SYNC_UPSTREAM_READ_TOKEN`   | No       | Read token for private upstream releases.         |

## `handle-template-sync-command`

Handles `/template-sync` comments on migration PRs.

```sh
handle-template-sync-command
```

Environment:

| Name                                             | Required                                 | Description                                                                                                                                                                                                  |
| ------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GITHUB_REPOSITORY`                              | Yes                                      | Subscriber repository in `OWNER/REPO` form.                                                                                                                                                                  |
| `GITHUB_EVENT_PATH`                              | Yes                                      | GitHub event payload path.                                                                                                                                                                                   |
| `TEMPLATE_SYNC_BOT_TOKEN`                        | Yes                                      | Bot token for checkout, push, comments, and variables.                                                                                                                                                       |
| `TEMPLATE_SYNC_DEFAULT_UPSTREAM_REPO`            | Yes                                      | Default template repository.                                                                                                                                                                                 |
| `OPENAI_API_KEY`                                 | Yes for approve/revise without a harness | API key for direct OpenAI generation. Mock responses still require it so missing production configuration fails clearly.                                                                                     |
| `OPENAI_MODEL`                                   | No                                       | Direct OpenAI generation model. Defaults to `gpt-5.5`.                                                                                                                                                       |
| `TEMPLATE_SYNC_GENERATION_HARNESS_COMMAND`       | No                                       | External generation command. Use a JSON array such as `["node","scripts/template-sync-harness.mjs"]` or a shell-like string. The command receives prompt JSON on stdin and must return generation plan JSON. |
| `TEMPLATE_SYNC_GENERATION_HARNESS_ENV_ALLOWLIST` | No                                       | Comma-separated sensitive environment variable names to pass to the harness. Sensitive variables are stripped by default; GitHub and template sync tokens are never passed.                                  |
| `TEMPLATE_SYNC_GENERATION_MOCK_RESPONSE`         | No                                       | JSON plan used for local or test runs instead of OpenAI or a harness. `OPENAI_API_KEY` is still required for approve/revise so missing production configuration fails clearly.                               |

When a harness command is configured, `handle-template-sync-command` writes the same prompt JSON to `TEMPLATE_SYNC_GENERATION_PROMPT_PATH`, sets `TEMPLATE_SYNC_GENERATION_OUTPUT_PATH`, and also sends the prompt on stdin. The harness can either write the plan JSON to that output path or print it to stdout. The harness must not edit the checkout directly; direct worktree edits fail the command before the structured plan is applied.
