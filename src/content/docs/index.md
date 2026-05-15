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
4. If requested, the tool generates one reusable summary of the template changes.
5. The tool creates `migration-bundle.json`.
6. The tool publishes a GitHub Release tagged `template-migration/pr-N-sha`.
7. The subscriber workflow runs `subscriber-template-sync`.
8. The tool finds the newest upstream migration release.
9. The tool skips the migration if it was already opened, applied, or declined.
10. The tool opens a draft PR in the subscriber repository.
11. A maintainer comments on the PR with `/template-sync approve`, `/template-sync revise`, or `/template-sync decline`.
12. The command workflow runs `handle-template-sync-command`.
13. The tool checks that the commenter has `write`, `maintain`, or `admin` permission.
14. If the command is `decline`, the tool closes the PR and marks the migration declined.
15. If the command is `approve` or `revise`, the tool checks out the migration PR branch.
16. The tool collects subscriber context: affected files and config files.
17. The tool builds a generation prompt from the bundle, repo context, drift, and maintainer instructions.
18. OpenAI or a configured custom model endpoint returns JSON file operations: `create`, `update`, or `delete`.
19. The tool validates the JSON and safe paths.
20. The tool writes the generated file changes.
21. The tool skips lockfile refresh and subscriber package scripts in the privileged command workflow.
22. The tool commits, pushes, and comments with a summary.
23. The tool marks the migration applied in repository variables.
24. Normal PR CI or local review validates the generated branch without exposing template sync secrets to generated code.

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
