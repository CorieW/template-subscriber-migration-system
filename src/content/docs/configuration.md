---
title: Configuration
description: Environment variables, secrets, and repository variables used by the workflows.
---

## Template Repository

Set these in repositories that publish template migrations with `.github/workflows/template-publish-migration.yml`.

### Environment

| Name                    | Required | Description                                                                            |
| ----------------------- | -------- | -------------------------------------------------------------------------------------- |
| `TEMPLATE_SYNC_PACKAGE` | Yes      | Package spec installed by `npm exec`, such as an npm version, git URL, or tarball URL. |

### Secrets

| Name           | Required | Description                                                                                   |
| -------------- | -------- | --------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN` | Built in | GitHub Actions token used to read PRs and publish release assets. No manual secret is needed. |

The template repository does not need `OPENAI_API_KEY`.

## Subscriber Repositories

Set these in repositories that receive template migrations with `.github/workflows/template-sync.yml` and `.github/workflows/template-migration-command.yml`.

### Environment

| Name                                  | Required | Description                                                                            |
| ------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| `TEMPLATE_SYNC_PACKAGE`               | Yes      | Package spec installed by `npm exec`, such as an npm version, git URL, or tarball URL. |
| `TEMPLATE_SYNC_DEFAULT_UPSTREAM_REPO` | Yes      | Default upstream template repository in `OWNER/REPO` form.                             |
| `OPENAI_MODEL`                        | No       | Model used for generation. Defaults to `gpt-5.5` in the workflow example.              |

### Secrets

| Name                                | Required | Description                                                                      |
| ----------------------------------- | -------- | -------------------------------------------------------------------------------- |
| `TEMPLATE_SYNC_BOT_TOKEN`           | Yes      | Token for opening PRs, pushing commits, writing comments, labels, and variables. |
| `OPENAI_API_KEY`                    | Yes      | OpenAI API key for approve and revise generation.                                |
| `TEMPLATE_SYNC_UPSTREAM_READ_TOKEN` | No       | Token for reading private template releases.                                     |

### Repository Variables

Subscriber workflows create and update these automatically:

| Name                                       | Description                                    |
| ------------------------------------------ | ---------------------------------------------- |
| `TEMPLATE_SYNC_LAST_HANDLED_MIGRATION_ID`  | Newest migration opened, applied, or declined. |
| `TEMPLATE_SYNC_LAST_APPLIED_MIGRATION_ID`  | Newest migration applied.                      |
| `TEMPLATE_SYNC_LAST_DECLINED_MIGRATION_ID` | Newest migration declined.                     |
| `TEMPLATE_SYNC_UPSTREAM_REPO`              | Optional upstream override for one subscriber. |
