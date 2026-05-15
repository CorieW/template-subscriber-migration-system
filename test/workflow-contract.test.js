import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("publish workflow is manual only and publishes PR-scoped release assets", () => {
  const workflow = read(".github/workflows/template-publish-migration.yml");
  const script = read("scripts/publish-template-migration.mjs");
  const constants = read("src/template-sync/constants.js");

  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /generate_summary:/);
  assert.doesNotMatch(workflow, /^\s*push:/m);
  assert.doesNotMatch(workflow, /^\s*pull_request:/m);
  assert.match(workflow, /contents: write/);
  assert.match(workflow, /TEMPLATE_SYNC_PACKAGE:/);
  assert.match(workflow, /TEMPLATE_SYNC_GENERATE_SUMMARY/);
  assert.match(workflow, /TEMPLATE_SYNC_AI_PROVIDER: openai/);
  assert.match(workflow, /TEMPLATE_SYNC_AI_MODEL: gpt-5\.5/);
  assert.match(workflow, /OPENAI_API_KEY/);
  assert.match(workflow, /GEMINI_API_KEY/);
  assert.match(workflow, /ANTHROPIC_API_KEY/);
  assert.match(workflow, /Change this to pin a version, git URL, or tarball package spec/);
  assert.match(workflow, /TEMPLATE_SYNC_PACKAGE: template-subscriber-migration-system@latest/);
  assert.match(
    workflow,
    /npm install --global --prefix "\$RUNNER_TEMP\/template-sync" --ignore-scripts "\$TEMPLATE_SYNC_PACKAGE"/,
  );
  assert.match(workflow, /run: publish-template-migration "\$\{\{ inputs\.pr_number \}\}"/);
  assert.doesNotMatch(workflow, /npm exec/);
  assert.ok(workflow.indexOf("Install template sync package") < workflow.indexOf("OPENAI_API_KEY"));
  assert.match(script, /repository\.default_branch/);
  assert.match(script, /templateBranch/);
  assert.match(script, /createMigrationBundle/);
  assert.match(script, /callAiForMigrationSummary/);
  assert.match(script, /resolveAiProviderConfig/);
  assert.match(script, /TEMPLATE_SYNC_GENERATE_SUMMARY/);
  assert.match(script, /releases/);
  assert.match(script, /target_commitish: pullRequest\.merge_commit_sha/);
  assert.match(constants, /migration-bundle\.json/);
  assert.match(script, /application\/vnd\.github\.v3\.patch/);
});

test("subscriber sync workflow polls newest release and opens at most one draft PR", () => {
  const workflow = read(".github/workflows/template-sync.yml");
  const script = read("scripts/subscriber-sync.mjs");

  assert.match(workflow, /schedule:/);
  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /secrets\.TEMPLATE_SYNC_BOT_TOKEN/);
  assert.match(workflow, /TEMPLATE_SYNC_PACKAGE:/);
  assert.match(workflow, /Change this to pin a version, git URL, or tarball package spec/);
  assert.match(workflow, /TEMPLATE_SYNC_PACKAGE: template-subscriber-migration-system@latest/);
  assert.match(
    workflow,
    /npm install --global --prefix "\$RUNNER_TEMP\/template-sync" --ignore-scripts "\$TEMPLATE_SYNC_PACKAGE"/,
  );
  assert.match(workflow, /run: subscriber-template-sync/);
  assert.doesNotMatch(workflow, /npm exec/);
  assert.ok(workflow.indexOf("Install template sync package") < workflow.indexOf("TEMPLATE_SYNC_BOT_TOKEN"));
  assert.match(script, /selectNewestMigrationRelease/);
  assert.match(script, /migrationMatchesHandledState/);
  assert.match(script, /findOpenMigrationPullRequest/);
  assert.match(script, /createEmptyCommit/);
  assert.match(script, /draft: true/);
  assert.match(script, /writeSubscriberStateTransition\(subscriberApi, subscriberRepoFullName, "opened"/);
});

test("comment workflow supports approve revise decline with bot-token pushes", () => {
  const workflow = read(".github/workflows/template-migration-command.yml");
  const script = read("scripts/handle-template-sync-command.mjs");
  const validation = read("src/template-sync/validation.js");

  assert.match(workflow, /issue_comment/);
  assert.match(workflow, /template-migration-\$\{\{ github\.event\.issue\.number \}\}/);
  assert.match(workflow, /token: \$\{\{ secrets\.TEMPLATE_SYNC_BOT_TOKEN \}\}/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /TEMPLATE_SYNC_AI_PROVIDER: openai/);
  assert.match(workflow, /TEMPLATE_SYNC_AI_MODEL: gpt-5\.5/);
  assert.match(workflow, /OPENAI_API_KEY/);
  assert.match(workflow, /GEMINI_API_KEY/);
  assert.match(workflow, /ANTHROPIC_API_KEY/);
  assert.match(workflow, /TEMPLATE_SYNC_PACKAGE:/);
  assert.match(workflow, /Change this to pin a version, git URL, or tarball package spec/);
  assert.match(workflow, /TEMPLATE_SYNC_PACKAGE: template-subscriber-migration-system@latest/);
  assert.match(
    workflow,
    /npm install --global --prefix "\$RUNNER_TEMP\/template-sync" --ignore-scripts "\$TEMPLATE_SYNC_PACKAGE"/,
  );
  assert.match(workflow, /run: handle-template-sync-command/);
  assert.doesNotMatch(workflow, /npm exec/);
  assert.ok(workflow.indexOf("Install template sync package") < workflow.indexOf("OPENAI_API_KEY"));
  assert.match(script, /parseTemplateSyncCommand/);
  assert.match(script, /hasWritePermission/);
  assert.match(script, /assertTemplateMigrationPullRequest/);
  assert.match(script, /migrationBranchName/);
  assert.match(script, /writeSubscriberStateTransition\(api, repoFullName, "declined"/);
  assert.match(script, /writeSubscriberStateTransition\(api, repoFullName, "applied"/);
  assert.match(script, /ls-files", "--modified", "--deleted", "--others", "--exclude-standard"/);
  assert.match(script, /skippedPrivilegedValidationResults/);
  assert.match(validation, /generated repository code is untrusted/);
  assert.doesNotMatch(script, /refreshDependencies/);
  assert.doesNotMatch(script, /runValidation/);
  assert.match(script, /renderCommandFailureComment/);
  assert.match(script, /templateSyncAlreadyCommented/);
  assert.match(script, /Cannot approve after initial generation/);
  assert.match(script, /OPENAI_API_KEY/);
  assert.match(script, /GEMINI_API_KEY/);
  assert.match(script, /ANTHROPIC_API_KEY/);
  assert.match(script, /callAiForGeneration/);
  assert.match(script, /resolveAiProviderConfig/);
  assert.ok(
    script.indexOf("const aiProviderConfig = resolveAiProviderConfig();") <
      script.indexOf("process.env.TEMPLATE_SYNC_GENERATION_MOCK_RESPONSE"),
  );
  assert.ok(
    script.indexOf("applyGenerationPlan(generationPlan, { root })") <
      script.lastIndexOf("commitAndPushIfNeeded({ repoFullName, botToken, migrationId, mode: command.action })"),
  );
  assert.match(script, /Buffer\.from\(`x-access-token:\$\{token\}`\)/);
  assert.match(script, /GIT_CONFIG_KEY_0: "http\.https:\/\/github\.com\/\.extraheader"/);
  assert.doesNotMatch(script, /remote", "set-url", "origin", `https:\/\/x-access-token/);
  assert.match(script, /fetch", repoUrl, `\$\{branchName\}:template-sync-worktree`/);
  assert.match(script, /push", repositoryHttpsUrl\(repoFullName\), `HEAD:\$\{branchName\}`/);
  assert.doesNotMatch(script, /`HEAD:\$\{pullRequest\.head\.ref\}`/);
});

test("package exposes installable command binaries", () => {
  const packageJson = JSON.parse(read("package.json"));

  assert.equal(packageJson.private, undefined);
  assert.equal(packageJson.type, "module");
  assert.equal(packageJson.engines.node, ">=20");
  assert.deepEqual(packageJson.bin, {
    "publish-template-migration": "./scripts/publish-template-migration.mjs",
    "subscriber-template-sync": "./scripts/subscriber-sync.mjs",
    "handle-template-sync-command": "./scripts/handle-template-sync-command.mjs",
  });
  assert.deepEqual(packageJson.files, [
    ".github/workflows/template-migration-command.yml",
    ".github/workflows/template-publish-migration.yml",
    ".github/workflows/template-sync.yml",
    "scripts/",
    "src/content/docs/",
    "src/template-sync/",
    "README.md",
  ]);
});

test("ci workflow runs format lint test knip and docs build", () => {
  const workflow = read(".github/workflows/ci.yml");
  const packageJson = JSON.parse(read("package.json"));

  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /branches:\n\s+- master/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run format:check/);
  assert.match(workflow, /npm run lint/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run knip/);
  assert.match(workflow, /npm run docs:build/);
  assert.doesNotMatch(workflow, /actions\/(?:checkout|setup-node)@v4/);
  assert.match(workflow, /node-version: "22"/);
  assert.equal(
    packageJson.scripts["format:check"],
    "prettier --config config/prettier.config.json --ignore-path .gitignore --ignore-path config/prettierignore --check .",
  );
  assert.match(packageJson.scripts.lint, /eslint --config config\/eslint\.config\.js \./);
  assert.equal(packageJson.scripts.knip, "knip --config config/knip.json");
  assert.equal(packageJson.scripts["docs:build"], "astro build");
});

test("release workflow uses changesets and can deploy docs manually", () => {
  const workflow = read(".github/workflows/release.yml");
  const packageJson = JSON.parse(read("package.json"));
  const changesetConfig = JSON.parse(read(".changeset/config.json"));

  assert.doesNotMatch(workflow, /^\s*push:/m);
  assert.match(workflow, /contents: write/);
  assert.match(workflow, /pull-requests: write/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /uses: changesets\/action@v1/);
  assert.match(workflow, /publish: npm run release/);
  assert.match(workflow, /title: "chore\(release\): version packages"/);
  assert.match(workflow, /commit: "chore\(release\): version packages"/);
  assert.match(workflow, /node-version: "24"/);
  assert.match(workflow, /registry-url: "https:\/\/registry\.npmjs\.org"/);
  assert.match(workflow, /NPM_CONFIG_PROVENANCE: true/);
  assert.doesNotMatch(workflow, /NPM_TOKEN/);
  assert.doesNotMatch(workflow, /NODE_AUTH_TOKEN/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /deploy_docs:/);
  assert.match(workflow, /npm run docs:build/);
  assert.match(workflow, /uses: actions\/upload-pages-artifact@v3/);
  assert.match(workflow, /Check Pages configuration/);
  assert.match(workflow, /node-version: "22"/);
  assert.match(workflow, /uses: actions\/deploy-pages@v4/);
  assert.equal(packageJson.scripts.changeset, "changeset");
  assert.equal(packageJson.scripts.version, "changeset version");
  assert.equal(packageJson.scripts.release, "changeset publish");
  assert.equal(packageJson.repository.url, "git+https://github.com/CorieW/template-subscriber-migration-system.git");
  assert.equal(changesetConfig.access, "public");
});

test("docs deploy workflow publishes starlight docs to github pages", () => {
  const workflow = read(".github/workflows/deploy-docs.yml");
  const astroConfig = read("astro.config.mjs");
  const contentConfig = read("src/content.config.js");

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /branches:\n\s+- master/);
  assert.match(workflow, /pages: write/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /npm run docs:build/);
  assert.match(workflow, /"src\/styles\/\*\*"/);
  assert.match(workflow, /uses: actions\/upload-pages-artifact@v3/);
  assert.match(workflow, /Check Pages configuration/);
  assert.match(workflow, /pages_enabled: \$\{\{ steps\.pages\.outputs\.enabled \}\}/);
  assert.match(workflow, /node-version: "22"/);
  assert.match(workflow, /uses: actions\/deploy-pages@v4/);
  assert.match(astroConfig, /@astrojs\/starlight/);
  assert.match(astroConfig, /DOCS_BASE_PATH/);
  assert.match(astroConfig, /customCss: \["\/src\/styles\/github-dark\.css"\]/);
  assert.match(astroConfig, /github-dark-default/);
  assert.match(contentConfig, /docsLoader/);
  assert.match(contentConfig, /docsSchema/);
});
