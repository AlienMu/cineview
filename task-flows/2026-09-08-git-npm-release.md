# Git commit and npm release

## Scope

The user requested a Git commit of the current project and publication to npm. Prepare `cineview@1.0.0`, preserve existing user changes, validate the framework and site, inspect the package payload, commit and push the current branch, and publish to the public npm registry.

The initial worktree contains 287 modified, 137 deleted, and 71 untracked status entries. Historical evidence deletions predate this task; no additional evidence cleanup is authorized. Local backups and transient probe results remain outside the commit. The existing local `v1.0.0` tag refers to an older commit and will not be rewritten.

## Nodes

- [x] Inspect Git status, package configuration, registry availability, and authentication.
- [x] Complete framework static gate and independent browser release acceptance.
- [x] Complete site types, contracts, documentation style, and production build.
- [x] Inspect packed package; stage and review current changes before committing.
- [x] Commit the reviewed release changes.
- [ ] Publish to npm and verify registry metadata.

## Evidence

- Registry query returned 404 for `cineview`; package version is `1.0.0`.
- npm authentication is initially absent; a browser login was initiated for the user.
- Site checks passed: 16 suites / 79 contract tests, no static documentation structure issues, site type check, and production build. The pre-existing large JavaScript chunk warning remains.
- Site logs: `/tmp/cineview-release-site-{type-check,contracts,docs-style,build}.log`.
- Framework release gate log: `/tmp/cineview-release-framework-static.log`.

## Release preparation

- Framework static gate passed on Node 22.22.1: 118 suites / 1,582 tests; statement coverage 94.85%, branches 90.22%, functions 95.15%, lines 96.27%. All 24 example tests passed. Build checks passed 17/17, including packed ESM/CommonJS/mode/dev imports, types, SSR, and exported CSS. All five deliberate static fault injections were rejected.
- The only gate correction was Prettier formatting in `src/components/CineView/directScrollHelpers.test.ts`; its behavior is unchanged.
- Root type check and site formatting also passed.
- Release documentation updates both READMEs, both installation pages, and the 1.0.0 changelog. npm success remains unclaimed until the registry verifies publication.
- A read-only independent audit found no obvious credentials or oversized new files in the changed and new text. Temporary translation scripts, backups, debug probes, screenshot samples, and transient test state remain on disk outside the commit.
- Independent drag and scroll browser acceptance passed against the built fixture routes. Coverage includes forward/reverse inputs, large deltas, keyboard, touch, native scrolling, scrollbar, fixed layers, concurrent animation, re-grab behavior, console errors, and long tasks. All eight browser fault injections were rejected as expected. Environment: Node 22.22.1, Chrome 152.0.7977.77, 390×844. Logs: `/tmp/cineview-release-browser-acceptance.log` and `/tmp/cineview-release-browser-failure-injection.log`.

- Final packed payload: 128 files, 273,249 bytes compressed and 950,252 bytes unpacked. Contents are runtime/type/CSS artifacts, package metadata, LICENSE, and both READMEs; no source, credential, backup, or probe files are included. Archive: `/tmp/cineview-release-payload/cineview-1.0.0.tgz`.

- The pre-commit hook also checks staged site source. It found three unused initial zero assignments in `DemoVideoScene.warmAt`; each variable is assigned on every branch before use. Removing only those initializers preserves output. File lint and site types passed after correction. The failed hook restored its temporary changes before this fix.

## Git result and remaining publication step

- Release commit: `ba0adf4` (`feat: prepare CineView 1.0.0 for npm release`). The commit contains 475 reviewed changed/new/deleted files. The successful pre-commit hook left the staged tree identical to its pre-hook snapshot.
- The tracked working tree was clean after committing. The 29 excluded local files remain on disk (some share directory-level status entries).
- Pushing `codex/drag-release-dual-gate` to origin runs the repository's required framework static hook. The first attempt selected the shell's older Node 21 and failed before upload; the next attempt explicitly selects Node 22.22.1.
- npm publication remains pending user authentication. `npm whoami --registry=https://registry.npmjs.org` still returns `ENEEDAUTH`. A browser login was requested; the user can also run `npm login --registry=https://registry.npmjs.org` locally, then resume publication. No npm publish success is claimed.
