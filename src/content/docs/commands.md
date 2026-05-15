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

| Name                                  | Required                                                     | Description                                                                                      |
| ------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `GITHUB_REPOSITORY`                   | Yes                                                          | Template repository in `OWNER/REPO` form.                                                        |
| `GITHUB_TOKEN`                        | Yes                                                          | Token with release write access and PR read access.                                              |
| `TEMPLATE_SYNC_GENERATE_SUMMARY`      | No                                                           | Set to `true`, `1`, `yes`, or `on` to generate one reusable migration summary during publishing. |
| `OPENAI_API_KEY`                      | Yes when summary generation uses the default OpenAI endpoint | API key for summary generation with OpenAI.                                                      |
| `OPENAI_MODEL`                        | No                                                           | Summary model name. Defaults to `gpt-5.5`.                                                       |
| `TEMPLATE_SYNC_MODEL_ENDPOINT_URL`    | No                                                           | Custom HTTP endpoint for summary generation. Defaults to the OpenAI Responses API.               |
| `TEMPLATE_SYNC_MODEL_API_KEY`         | No                                                           | Optional bearer token sent only to `TEMPLATE_SYNC_MODEL_ENDPOINT_URL`.                           |
| `TEMPLATE_SYNC_SUMMARY_MOCK_RESPONSE` | No                                                           | JSON summary response used for local or test runs instead of a live model call.                  |

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

| Name                                     | Required                                                | Description                                                                                                                                        |
| ---------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GITHUB_REPOSITORY`                      | Yes                                                     | Subscriber repository in `OWNER/REPO` form.                                                                                                        |
| `GITHUB_EVENT_PATH`                      | Yes                                                     | GitHub event payload path.                                                                                                                         |
| `TEMPLATE_SYNC_BOT_TOKEN`                | Yes                                                     | Bot token for checkout, push, comments, and variables.                                                                                             |
| `TEMPLATE_SYNC_DEFAULT_UPSTREAM_REPO`    | Yes                                                     | Default template repository.                                                                                                                       |
| `OPENAI_API_KEY`                         | Yes for approve/revise with the default OpenAI endpoint | API key for direct OpenAI generation. Mock responses still require direct model configuration so missing production configuration fails clearly.   |
| `OPENAI_MODEL`                           | No                                                      | Direct generation model name. Defaults to `gpt-5.5`.                                                                                               |
| `TEMPLATE_SYNC_MODEL_ENDPOINT_URL`       | No                                                      | Custom HTTP endpoint for direct generation. Defaults to the OpenAI Responses API.                                                                  |
| `TEMPLATE_SYNC_MODEL_API_KEY`            | No                                                      | Optional bearer token sent only to `TEMPLATE_SYNC_MODEL_ENDPOINT_URL`.                                                                             |
| `TEMPLATE_SYNC_GENERATION_MOCK_RESPONSE` | No                                                      | JSON plan used for local or test runs instead of a model endpoint. Direct model configuration is still required so missing configuration is clear. |

When `TEMPLATE_SYNC_MODEL_ENDPOINT_URL` is set, direct model calls post an OpenAI Responses-compatible JSON payload to that URL. The endpoint can return either an OpenAI-style `output_text`/`output` response or direct JSON matching the requested schema. `OPENAI_API_KEY` is not sent to custom endpoints; set `TEMPLATE_SYNC_MODEL_API_KEY` when the endpoint needs bearer authentication.
