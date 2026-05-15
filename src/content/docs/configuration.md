---
title: Configuration
description: Environment variables, secrets, and repository variables used by the workflows.
---

## Template Repository

Set these in repositories that publish template migrations with `.github/workflows/template-publish-migration.yml`.

### Environment

| Name                               | Required | Description                                                                                                                                                                         |
| ---------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TEMPLATE_SYNC_PACKAGE`            | No       | Package spec installed by the workflow with npm `--ignore-scripts`. Defaults to `template-subscriber-migration-system@latest`; change it to pin a version, git URL, or tarball URL. |
| `OPENAI_MODEL`                     | No       | Model name sent for optional migration summary generation. Defaults to `gpt-5.5`.                                                                                                   |
| `TEMPLATE_SYNC_MODEL_ENDPOINT_URL` | No       | Custom HTTP endpoint for summary model calls. Defaults to the OpenAI Responses API.                                                                                                 |

### Secrets

| Name                          | Required                                                                  | Description                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN`                | Built in                                                                  | GitHub Actions token used to read PRs and publish release assets. No manual secret is needed.         |
| `OPENAI_API_KEY`              | Only when `generate_summary` is true and no custom endpoint is configured | OpenAI API key for one-time migration summary generation. Used only with the default OpenAI endpoint. |
| `TEMPLATE_SYNC_MODEL_API_KEY` | No                                                                        | Optional bearer token sent only to `TEMPLATE_SYNC_MODEL_ENDPOINT_URL`.                                |

The template repository does not need model credentials unless optional summary generation is enabled.

## Subscriber Repositories

Set these in repositories that receive template migrations with `.github/workflows/template-sync.yml` and `.github/workflows/template-migration-command.yml`.

### Environment

| Name                                  | Required | Description                                                                                                                                                                         |
| ------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TEMPLATE_SYNC_PACKAGE`               | No       | Package spec installed by the workflow with npm `--ignore-scripts`. Defaults to `template-subscriber-migration-system@latest`; change it to pin a version, git URL, or tarball URL. |
| `TEMPLATE_SYNC_DEFAULT_UPSTREAM_REPO` | Yes      | Default upstream template repository in `OWNER/REPO` form.                                                                                                                          |
| `OPENAI_MODEL`                        | No       | Model name sent for direct generation. Defaults to `gpt-5.5` in the workflow example.                                                                                               |
| `TEMPLATE_SYNC_MODEL_ENDPOINT_URL`    | No       | Custom HTTP endpoint for direct generation. Defaults to the OpenAI Responses API.                                                                                                   |

### Secrets

| Name                                | Required                                   | Description                                                                               |
| ----------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `TEMPLATE_SYNC_BOT_TOKEN`           | Yes                                        | Token for opening PRs, pushing commits, writing comments, labels, and variables.          |
| `OPENAI_API_KEY`                    | Yes unless a custom endpoint is configured | OpenAI API key for direct approve and revise generation with the default OpenAI endpoint. |
| `TEMPLATE_SYNC_MODEL_API_KEY`       | No                                         | Optional bearer token sent only to `TEMPLATE_SYNC_MODEL_ENDPOINT_URL`.                    |
| `TEMPLATE_SYNC_UPSTREAM_READ_TOKEN` | No                                         | Token for reading private template releases.                                              |

When `TEMPLATE_SYNC_MODEL_ENDPOINT_URL` is set, direct model calls post an OpenAI Responses-compatible JSON payload to that URL. The endpoint can return either an OpenAI-style `output_text`/`output` response or direct JSON matching the requested schema. `OPENAI_API_KEY` is not sent to custom endpoints; set `TEMPLATE_SYNC_MODEL_API_KEY` when the endpoint needs bearer authentication.

### Repository Variables

Subscriber workflows create and update these automatically:

| Name                                       | Description                                    |
| ------------------------------------------ | ---------------------------------------------- |
| `TEMPLATE_SYNC_LAST_HANDLED_MIGRATION_ID`  | Newest migration opened, applied, or declined. |
| `TEMPLATE_SYNC_LAST_APPLIED_MIGRATION_ID`  | Newest migration applied.                      |
| `TEMPLATE_SYNC_LAST_DECLINED_MIGRATION_ID` | Newest migration declined.                     |
| `TEMPLATE_SYNC_UPSTREAM_REPO`              | Optional upstream override for one subscriber. |
