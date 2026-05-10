---
title: Commands
description: Package binary command reference with examples.
---

## `publish-template-migration`

Publishes a migration bundle release from a merged template PR.

```sh
npm exec --yes --package "$TEMPLATE_SYNC_PACKAGE" -- publish-template-migration 123
```

Environment:

| Name                | Required | Description                                         |
| ------------------- | -------- | --------------------------------------------------- |
| `GITHUB_REPOSITORY` | Yes      | Template repository in `OWNER/REPO` form.           |
| `GITHUB_TOKEN`      | Yes      | Token with release write access and PR read access. |

## `subscriber-template-sync`

Discovers the newest migration and opens a draft PR in a subscriber repository.

```sh
npm exec --yes --package "$TEMPLATE_SYNC_PACKAGE" -- subscriber-template-sync
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
npm exec --yes --package "$TEMPLATE_SYNC_PACKAGE" -- handle-template-sync-command
```

Environment:

| Name                                     | Required               | Description                                              |
| ---------------------------------------- | ---------------------- | -------------------------------------------------------- |
| `GITHUB_REPOSITORY`                      | Yes                    | Subscriber repository in `OWNER/REPO` form.              |
| `GITHUB_EVENT_PATH`                      | Yes                    | GitHub event payload path.                               |
| `TEMPLATE_SYNC_BOT_TOKEN`                | Yes                    | Bot token for checkout, push, comments, and variables.   |
| `TEMPLATE_SYNC_DEFAULT_UPSTREAM_REPO`    | Yes                    | Default template repository.                             |
| `OPENAI_API_KEY`                         | Yes for approve/revise | API key for generation.                                  |
| `OPENAI_MODEL`                           | No                     | Generation model. Defaults to `gpt-5.5`.                 |
| `TEMPLATE_SYNC_GENERATION_MOCK_RESPONSE` | No                     | JSON plan used for local or test runs instead of OpenAI. |
