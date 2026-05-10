---
title: Subscriber Setup
description: Let subscriber repositories discover template migrations and open draft PRs.
---

## Discovery Workflow

Use `.github/workflows/template-sync.yml` in subscriber repositories.

Required workflow environment:

```yaml
env:
  TEMPLATE_SYNC_DEFAULT_UPSTREAM_REPO: octo-org/template-repo
  TEMPLATE_SYNC_PACKAGE: template-subscriber-migration-system@latest
```

The workflow runs daily and can be triggered manually.

## What It Does

`subscriber-template-sync`:

1. Reads subscriber state from repository variables.
2. Reads the upstream template repository from `TEMPLATE_SYNC_UPSTREAM_REPO` or `TEMPLATE_SYNC_DEFAULT_UPSTREAM_REPO`.
3. Selects the newest non-draft, non-prerelease `template-migration/` release.
4. Skips if that migration was already opened, applied, or declined.
5. Skips if another open `template-migration` PR exists.
6. Creates a placeholder branch and draft PR.
7. Labels the PR with `template-migration`.
8. Writes `TEMPLATE_SYNC_LAST_HANDLED_MIGRATION_ID`.

## State Variables

| Variable                                   | Meaning                                         |
| ------------------------------------------ | ----------------------------------------------- |
| `TEMPLATE_SYNC_LAST_HANDLED_MIGRATION_ID`  | Newest migration opened, applied, or declined.  |
| `TEMPLATE_SYNC_LAST_APPLIED_MIGRATION_ID`  | Newest migration applied successfully.          |
| `TEMPLATE_SYNC_LAST_DECLINED_MIGRATION_ID` | Newest migration declined by a maintainer.      |
| `TEMPLATE_SYNC_UPSTREAM_REPO`              | Optional subscriber-specific upstream override. |

## Private Upstream Repositories

If the template repository is private, set `TEMPLATE_SYNC_UPSTREAM_READ_TOKEN` in each subscriber. If omitted, the bot token is reused.
