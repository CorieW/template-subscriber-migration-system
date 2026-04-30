# Template Subscriber Migration System

This repository contains GitHub Actions workflows and Node scripts for publishing template migration bundles and letting subscriber repositories opt into generated downstream migration PRs.

## What It Does

Use this system when one repository acts as a template and many downstream repositories were created from it. When a template PR is merged, the template repository can publish a migration bundle as a GitHub Release. Subscriber repositories can then discover the newest bundle, open a draft migration PR, and let a maintainer decide whether to apply, revise, or decline the migration.

The system has two sides:

- **Template repository**: publishes migration bundle releases from merged template PRs.
- **Subscriber repositories**: poll the template releases, open draft migration PRs, and use OpenAI to generate subscriber-specific changes after approval.

## Included Workflows

- `.github/workflows/template-publish-migration.yml` manually publishes one GitHub Release per merged template PR into `main`.
- `.github/workflows/template-sync.yml` runs daily or manually in subscriber repos, discovers only the newest `template-migration/` release, and opens one draft migration PR at a time.
- `.github/workflows/template-migration-command.yml` handles `/template-sync approve`, `/template-sync revise`, and `/template-sync decline` comments on migration PRs.

## How To Use It

### 1. Add the files to the template repository

Copy the workflows, scripts, and `src/template-sync` modules into the repository that will act as the upstream template.

Keep this workflow enabled in the template repository:

```text
.github/workflows/template-publish-migration.yml
```

This workflow is manually triggered and requires a merged PR number. It reads the merged PR, captures its changed files and patch, and publishes a release tagged like:

```text
template-migration/pr-123-abc1234
```

The release includes a `migration-bundle.json` asset that subscriber repositories will consume.

### 2. Configure the subscriber workflows before creating subscribers

In both subscriber workflow files, set `TEMPLATE_SYNC_DEFAULT_UPSTREAM_REPO` to the template repository full name:

```yaml
env:
  TEMPLATE_SYNC_DEFAULT_UPSTREAM_REPO: octo-org/template-repo
```

Update these files:

```text
.github/workflows/template-sync.yml
.github/workflows/template-migration-command.yml
```

If subscribers are generated from the template, make this change in the template before creating or updating subscriber repositories so the copied workflows already point back to the correct upstream template.

### 3. Add subscriber repository secrets

Each subscriber repository needs these secrets:

| Secret | Required | Purpose |
| --- | --- | --- |
| `TEMPLATE_SYNC_BOT_TOKEN` | Yes | Fine-grained token used to open PRs, push migration commits, comment on PRs, and write repository variables. |
| `OPENAI_API_KEY` | Yes | Used by `/template-sync approve` and `/template-sync revise` to generate the subscriber-specific code changes. |
| `TEMPLATE_SYNC_UPSTREAM_READ_TOKEN` | No | Token used to read private upstream template releases. If omitted, the bot token is reused. |

The bot token should have access to the subscriber repository with permissions for contents, pull requests, issues, and repository variable writes.

### 4. Publish a template migration

After a template PR is merged into `main`, run the **Publish template migration** workflow in the template repository.

Provide the merged PR number:

```text
pr_number: 123
```

The workflow validates that the PR belongs to the template repo, targets `main`, and is merged. It then creates a GitHub Release with a `template-migration/` tag and uploads `migration-bundle.json`.

### 5. Let subscribers discover the migration

The **Template sync** workflow in each subscriber repository runs daily at `03:17 UTC` and can also be triggered manually.

When it runs, it:

1. Reads the configured upstream template repository.
2. Finds the newest non-draft, non-prerelease `template-migration/` release.
3. Skips the migration if it was already opened, applied, or declined.
4. Skips if another open `template-migration` PR already exists.
5. Opens a draft PR from a branch named like `template-migrations/template-migration/pr-123-abc1234`.
6. Labels the PR with `template-migration`.

The draft PR initially contains context from the template PR but no generated code changes. A maintainer must approve, revise, or decline it with a PR comment.

### 6. Approve, revise, or decline a migration PR

Commands must be the first line of a comment on the migration PR. Only users with `write`, `maintain`, or `admin` permission can run them.

Approve the migration and let OpenAI generate the subscriber changes:

```text
/template-sync approve
```

Approve with implementation guidance:

```text
/template-sync approve
Keep the subscriber theme and preserve the existing analytics adapter.
```

Request a revision after an approval pass has generated changes:

```text
/template-sync revise
Use the existing settings module instead of creating a new config file.
```

Decline the migration and close the PR:

```text
/template-sync decline
```

For `approve` and `revise`, the workflow checks out the migration branch, gathers repository context, sends a structured generation prompt to OpenAI, applies the returned file operations, refreshes lockfiles when `package.json` changes, runs available validation scripts, commits any changes, pushes back to the PR branch, and comments with the result.

## Subscriber State

Subscriber repositories track handled migrations using GitHub Actions repository variables:

| Variable | Purpose |
| --- | --- |
| `TEMPLATE_SYNC_LAST_HANDLED_MIGRATION_ID` | Newest migration that opened a PR, was applied, or was declined. |
| `TEMPLATE_SYNC_LAST_APPLIED_MIGRATION_ID` | Newest migration successfully applied through an approve or revise command. |
| `TEMPLATE_SYNC_LAST_DECLINED_MIGRATION_ID` | Newest migration declined by a maintainer. |
| `TEMPLATE_SYNC_UPSTREAM_REPO` | Optional subscriber-specific override for the upstream template repository. |

The workflows create or update these variables automatically. Set `TEMPLATE_SYNC_UPSTREAM_REPO` manually only when a subscriber should follow a different template repository than the workflow default.

## Operational Notes

- Only merged PRs into `main` can be published as template migrations.
- Subscriber sync only considers the newest template migration release.
- A subscriber repository can have only one open `template-migration` PR at a time.
- Manual runs of `template-sync.yml` force a recheck of the newest migration, but still do not open a duplicate if an open migration PR already exists.
- Revision commands require a previous generation summary on the PR, so run `approve` before `revise`.
- The command workflow defaults to `OPENAI_MODEL: gpt-4.1`; change that environment value in `.github/workflows/template-migration-command.yml` if needed.
- Validation runs the subscriber repo's available `lint`, `typecheck`, and `test` package scripts.

## Development

This project requires Node.js 20 or newer.

Run tests:

```sh
npm test
```

Check JavaScript syntax:

```sh
npm run lint
```
