# template-subscriber-migration-system

## 0.2.2

### Patch Changes

- 573ba1c: Make generated operation schemas compatible with strict OpenAI Structured Outputs and allow delete operations to use null content.

## 0.2.1

### Patch Changes

- 02ce3e1: Accept approve/revise guidance on the same line as the template sync command and require `OPENAI_API_KEY` before generation, even when using mocked generation output.

## 0.2.0

### Minor Changes

- 8522882: - Default template sync workflows to `template-subscriber-migration-system@latest` while keeping `TEMPLATE_SYNC_PACKAGE` editable for pinned versions, git URLs, or tarball specs.
