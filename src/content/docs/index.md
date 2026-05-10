---
title: Template Subscriber Migration System
description: Publish template changes as migrations and let subscriber repositories opt in safely.
---

Template Subscriber Migration System helps one template repository publish migration bundles and many subscriber repositories decide how to apply them.

Use it when repositories start from a shared template, but later drift because each subscriber has local product code, configuration, or style choices.

## Workflow

1. A template PR merges.
2. A template maintainer runs `publish-template-migration <PR number>`.
3. The tool reads the merged PR, changed files, and full patch.
4. The tool creates `migration-bundle.json`.
5. The tool publishes a GitHub Release tagged `template-migration/pr-N-sha`.
6. The subscriber workflow runs `subscriber-template-sync`.
7. The tool finds the newest upstream migration release.
8. The tool skips the migration if it was already opened, applied, or declined.
9. The tool opens a draft PR in the subscriber repository.
10. A maintainer comments on the PR with `/template-sync approve`, `/template-sync revise`, or `/template-sync decline`.
11. The command workflow runs `handle-template-sync-command`.
12. The tool checks that the commenter has `write`, `maintain`, or `admin` permission.
13. If the command is `decline`, the tool closes the PR and marks the migration declined.
14. If the command is `approve` or `revise`, the tool checks out the migration PR branch.
15. The tool collects subscriber context: affected files and config files.
16. The tool builds an OpenAI prompt from the bundle, repo context, drift, and maintainer instructions.
17. OpenAI returns JSON file operations: `create`, `update`, or `delete`.
18. The tool validates the JSON and safe paths.
19. The tool writes the generated file changes.
20. The tool refreshes the lockfile if package dependencies changed.
21. The tool runs `lint`, `typecheck`, and `test` scripts if the subscriber repository has them.
22. If validation fails, the tool comments with the failure and does not mark the migration applied.
23. If validation passes, the tool commits, pushes, and comments with a summary.
24. The tool marks the migration applied in repository variables.

## Package Commands

The package exposes three binaries:

| Command                        | Runs in               | Purpose                                                 |
| ------------------------------ | --------------------- | ------------------------------------------------------- |
| `publish-template-migration`   | Template repository   | Publishes a migration release for a merged template PR. |
| `subscriber-template-sync`     | Subscriber repository | Opens a draft migration PR for the newest migration.    |
| `handle-template-sync-command` | Subscriber repository | Handles approve, revise, and decline comments.          |

## Start Here

- [Getting started](./getting-started/) shows a full setup.
- [Template setup](./template-setup/) explains publishing migrations.
- [Subscriber setup](./subscriber-setup/) explains discovery and PR creation.
- [Commands](./commands/) lists CLI inputs and environment variables.
