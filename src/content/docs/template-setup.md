---
title: Template Setup
description: Publish migration bundles from the upstream template repository.
---

## Workflow

Use `.github/workflows/template-publish-migration.yml` in the template repository.

Workflow package environment:

```yaml
env:
  TEMPLATE_SYNC_PACKAGE: template-subscriber-migration-system@latest
```

Optional summary model:

```yaml
env:
  OPENAI_MODEL: gpt-5.5
```

Required permissions:

```yaml
permissions:
  contents: write
  pull-requests: read
```

## Publish a Migration

Run the workflow manually after merging a template PR into the template repository default branch.

Example input:

```yaml
pr_number: 123
generate_summary: false
```

Set `generate_summary` to `true` when you want OpenAI to create one basic template-change summary during publishing. The summary is stored in `migration-bundle.json` and reused by every subscriber PR, so it is not regenerated per subscriber.

The command validates that the PR:

- belongs to the current template repository,
- targets the repository default branch,
- is merged,
- has a merge commit SHA.

It then creates a release and uploads `migration-bundle.json`.

## Bundle Contents

Each migration bundle includes:

- template repository name and branch,
- source PR title, body, labels, URL, merge SHA, and merge time,
- optional generated template-change summary,
- normalized changed file list,
- unified PR patch.

Subscriber repositories use the bundle as context for downstream generation.
