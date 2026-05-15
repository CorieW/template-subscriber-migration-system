---
title: Approve, Revise, or Decline
description: Use PR comments to control subscriber migration generation.
---

Commands must start on the first line of a comment on a migration PR. Only users with `write`, `maintain`, or `admin` repository permission can run them. Add guidance on the same line or in the remaining comment body.

## Approve

Generate the first subscriber change pass:

```text
/template-sync approve
```

Add implementation guidance after the first line:

```text
/template-sync approve
Use the existing settings module instead of creating a new config file.
```

Or put short guidance on the same line:

```text
/template-sync approve Use the existing settings module.
```

Use `approve` once. After a generation pass completes, use `revise` for follow-up changes.

## Revise

Request a new generation pass after an approval pass has completed:

```text
/template-sync revise
Keep the generated lockfile update, but move route constants into src/routes.js.
```

Short revision guidance can also go on the command line:

```text
/template-sync revise Move route constants into src/routes.js.
```

Revisions include previous generation summaries in the prompt so the model can react to maintainer feedback.

## Decline

Close the migration PR and mark the migration declined:

```text
/template-sync decline
```

## Validation Behavior

The command workflow applies generated file operations locally, commits, pushes, and comments with a summary. It does not refresh lockfiles or run subscriber `package.json` scripts because generated repository code is untrusted while provider API keys and GitHub tokens are present.

If a recognized command cannot complete, the workflow comments on the PR with the failure message. This includes missing configuration such as `OPENAI_API_KEY`, `GEMINI_API_KEY`, or `ANTHROPIC_API_KEY`, upstream release lookup failures, AI provider API failures, malformed generation output, checkout failures, and push failures. Errors that happen before the workflow can read the issue event or bot token still appear only in the GitHub Actions logs.

Run normal PR CI or local checks against the generated branch after the bot pushes it. Keep those PR checks free of repository secrets when they can execute generated code.
