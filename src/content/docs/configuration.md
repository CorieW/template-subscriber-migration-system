---
title: Configuration
description: Environment variables, secrets, and repository variables used by the workflows.
---

## Template Repository

Set these in repositories that publish template migrations with `.github/workflows/template-publish-migration.yml`.

### Environment

| Name                        | Required | Description                                                                                                                                                                         |
| --------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TEMPLATE_SYNC_PACKAGE`     | No       | Package spec installed by the workflow with npm `--ignore-scripts`. Defaults to `template-subscriber-migration-system@latest`; change it to pin a version, git URL, or tarball URL. |
| `TEMPLATE_SYNC_AI_PROVIDER` | No       | AI provider for optional migration summary generation: `openai`, `gemini`, or `anthropic`. Defaults to `openai`.                                                                    |
| `TEMPLATE_SYNC_AI_MODEL`    | No       | Model used for optional migration summary generation. Defaults to `gpt-5.5`, `gemini-2.5-flash`, or `claude-sonnet-4-5` based on provider.                                          |

### Secrets

| Name                | Required                             | Description                                                                                   |
| ------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN`      | Built in                             | GitHub Actions token used to read PRs and publish release assets. No manual secret is needed. |
| `OPENAI_API_KEY`    | Only when selected provider needs it | OpenAI API key for one-time migration summary generation.                                     |
| `GEMINI_API_KEY`    | Only when selected provider needs it | Gemini API key for one-time migration summary generation.                                     |
| `ANTHROPIC_API_KEY` | Only when selected provider needs it | Anthropic API key for one-time migration summary generation.                                  |

The template repository only needs the selected provider API key when optional summary generation is enabled.

## Subscriber Repositories

Set these in repositories that receive template migrations with `.github/workflows/template-sync.yml` and `.github/workflows/template-migration-command.yml`.

### Environment

| Name                                  | Required | Description                                                                                                                                                                         |
| ------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TEMPLATE_SYNC_PACKAGE`               | No       | Package spec installed by the workflow with npm `--ignore-scripts`. Defaults to `template-subscriber-migration-system@latest`; change it to pin a version, git URL, or tarball URL. |
| `TEMPLATE_SYNC_DEFAULT_UPSTREAM_REPO` | Yes      | Default upstream template repository in `OWNER/REPO` form.                                                                                                                          |
| `TEMPLATE_SYNC_AI_PROVIDER`           | No       | AI provider for approve/revise generation: `openai`, `gemini`, or `anthropic`. Defaults to `openai`.                                                                                |
| `TEMPLATE_SYNC_AI_MODEL`              | No       | Model used for generation. Defaults to `gpt-5.5`, `gemini-2.5-flash`, or `claude-sonnet-4-5` based on provider.                                                                     |

### Secrets

| Name                                | Required                             | Description                                                                      |
| ----------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------- |
| `TEMPLATE_SYNC_BOT_TOKEN`           | Yes                                  | Token for opening PRs, pushing commits, writing comments, labels, and variables. |
| `OPENAI_API_KEY`                    | Only when selected provider needs it | OpenAI API key for approve and revise generation.                                |
| `GEMINI_API_KEY`                    | Only when selected provider needs it | Gemini API key for approve and revise generation.                                |
| `ANTHROPIC_API_KEY`                 | Only when selected provider needs it | Anthropic API key for approve and revise generation.                             |
| `TEMPLATE_SYNC_UPSTREAM_READ_TOKEN` | No                                   | Token for reading private template releases.                                     |

`OPENAI_MODEL`, `GEMINI_MODEL`, and `ANTHROPIC_MODEL` are still honored when `TEMPLATE_SYNC_AI_MODEL` is unset.

### Repository Variables

Subscriber workflows create and update these automatically:

| Name                                       | Description                                    |
| ------------------------------------------ | ---------------------------------------------- |
| `TEMPLATE_SYNC_LAST_HANDLED_MIGRATION_ID`  | Newest migration opened, applied, or declined. |
| `TEMPLATE_SYNC_LAST_APPLIED_MIGRATION_ID`  | Newest migration applied.                      |
| `TEMPLATE_SYNC_LAST_DECLINED_MIGRATION_ID` | Newest migration declined.                     |
| `TEMPLATE_SYNC_UPSTREAM_REPO`              | Optional upstream override for one subscriber. |
