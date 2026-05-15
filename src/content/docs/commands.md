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

| Name                                  | Required                                                   | Description                                                                                                                  |
| ------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `GITHUB_REPOSITORY`                   | Yes                                                        | Template repository in `OWNER/REPO` form.                                                                                    |
| `GITHUB_TOKEN`                        | Yes                                                        | Token with release write access and PR read access.                                                                          |
| `TEMPLATE_SYNC_GENERATE_SUMMARY`      | No                                                         | Set to `true`, `1`, `yes`, or `on` to generate one reusable migration summary during publishing.                             |
| `TEMPLATE_SYNC_AI_PROVIDER`           | No                                                         | AI provider for summary generation: `openai`, `gemini`, or `anthropic`. Defaults to `openai`.                                |
| `TEMPLATE_SYNC_AI_MODEL`              | No                                                         | Summary model. Defaults to `gpt-5.5`, `gemini-2.5-flash`, or `claude-sonnet-4-5` based on provider.                          |
| `OPENAI_API_KEY`                      | Yes when selected provider is `openai` and summary runs    | OpenAI API key for summary generation.                                                                                       |
| `GEMINI_API_KEY`                      | Yes when selected provider is `gemini` and summary runs    | Gemini API key for summary generation.                                                                                       |
| `ANTHROPIC_API_KEY`                   | Yes when selected provider is `anthropic` and summary runs | Anthropic API key for summary generation.                                                                                    |
| `TEMPLATE_SYNC_SUMMARY_MOCK_RESPONSE` | No                                                         | JSON summary response used for local or test runs instead of the configured AI provider. Provider API key is still required. |

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

| Name                                     | Required                                  | Description                                                                                                                                         |
| ---------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GITHUB_REPOSITORY`                      | Yes                                       | Subscriber repository in `OWNER/REPO` form.                                                                                                         |
| `GITHUB_EVENT_PATH`                      | Yes                                       | GitHub event payload path.                                                                                                                          |
| `TEMPLATE_SYNC_BOT_TOKEN`                | Yes                                       | Bot token for checkout, push, comments, and variables.                                                                                              |
| `TEMPLATE_SYNC_DEFAULT_UPSTREAM_REPO`    | Yes                                       | Default template repository.                                                                                                                        |
| `TEMPLATE_SYNC_AI_PROVIDER`              | No                                        | AI provider for approve/revise generation: `openai`, `gemini`, or `anthropic`. Defaults to `openai`.                                                |
| `TEMPLATE_SYNC_AI_MODEL`                 | No                                        | Generation model. Defaults to `gpt-5.5`, `gemini-2.5-flash`, or `claude-sonnet-4-5` based on provider.                                              |
| `OPENAI_API_KEY`                         | Yes when selected provider is `openai`    | OpenAI API key for generation.                                                                                                                      |
| `GEMINI_API_KEY`                         | Yes when selected provider is `gemini`    | Gemini API key for generation.                                                                                                                      |
| `ANTHROPIC_API_KEY`                      | Yes when selected provider is `anthropic` | Anthropic API key for generation.                                                                                                                   |
| `TEMPLATE_SYNC_GENERATION_MOCK_RESPONSE` | No                                        | JSON plan used for local or test runs instead of the configured AI provider. Provider API key is still required so production config fails clearly. |
