---
title: Configuration
description: Environment variables, secrets, and repository variables used by the workflows.
---

## Template Repository

Set these in repositories that publish template migrations with `.github/workflows/template-publish-migration.yml`.

### Environment

| Name                    | Required | Description                                                                                                                                                                         |
| ----------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TEMPLATE_SYNC_PACKAGE` | No       | Package spec installed by the workflow with npm `--ignore-scripts`. Defaults to `template-subscriber-migration-system@latest`; change it to pin a version, git URL, or tarball URL. |
| `OPENAI_MODEL`          | No       | Model used for optional migration summary generation. Defaults to `gpt-5.5`.                                                                                                        |

### Secrets

| Name             | Required                             | Description                                                                                   |
| ---------------- | ------------------------------------ | --------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN`   | Built in                             | GitHub Actions token used to read PRs and publish release assets. No manual secret is needed. |
| `OPENAI_API_KEY` | Only when `generate_summary` is true | OpenAI API key for one-time migration summary generation.                                     |

The template repository does not need `OPENAI_API_KEY` unless optional summary generation is enabled.

## Subscriber Repositories

Set these in repositories that receive template migrations with `.github/workflows/template-sync.yml` and `.github/workflows/template-migration-command.yml`.

### Environment

| Name                                             | Required | Description                                                                                                                                                                         |
| ------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TEMPLATE_SYNC_PACKAGE`                          | No       | Package spec installed by the workflow with npm `--ignore-scripts`. Defaults to `template-subscriber-migration-system@latest`; change it to pin a version, git URL, or tarball URL. |
| `TEMPLATE_SYNC_DEFAULT_UPSTREAM_REPO`            | Yes      | Default upstream template repository in `OWNER/REPO` form.                                                                                                                          |
| `OPENAI_MODEL`                                   | No       | Model used for direct OpenAI generation. Defaults to `gpt-5.5` in the workflow example.                                                                                             |
| `TEMPLATE_SYNC_GENERATION_HARNESS_COMMAND`       | No       | Optional external generation harness command. When set, approve and revise use the harness instead of direct OpenAI generation.                                                     |
| `TEMPLATE_SYNC_GENERATION_HARNESS_ENV_ALLOWLIST` | No       | Comma-separated sensitive environment variable names to pass to the harness. GitHub and template sync tokens are always blocked.                                                    |

### Secrets

| Name                                | Required                           | Description                                                                      |
| ----------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------- |
| `TEMPLATE_SYNC_BOT_TOKEN`           | Yes                                | Token for opening PRs, pushing commits, writing comments, labels, and variables. |
| `OPENAI_API_KEY`                    | Yes unless a harness is configured | OpenAI API key for direct approve and revise generation.                         |
| `TEMPLATE_SYNC_UPSTREAM_READ_TOKEN` | No                                 | Token for reading private template releases.                                     |

Harness commands run with sensitive environment variables stripped by default. Set `TEMPLATE_SYNC_GENERATION_HARNESS_ENV_ALLOWLIST` only when the harness needs a model-provider secret such as `OPENAI_API_KEY`; GitHub and template sync tokens are never passed to the harness.

### Repository Variables

Subscriber workflows create and update these automatically:

| Name                                       | Description                                    |
| ------------------------------------------ | ---------------------------------------------- |
| `TEMPLATE_SYNC_LAST_HANDLED_MIGRATION_ID`  | Newest migration opened, applied, or declined. |
| `TEMPLATE_SYNC_LAST_APPLIED_MIGRATION_ID`  | Newest migration applied.                      |
| `TEMPLATE_SYNC_LAST_DECLINED_MIGRATION_ID` | Newest migration declined.                     |
| `TEMPLATE_SYNC_UPSTREAM_REPO`              | Optional upstream override for one subscriber. |
