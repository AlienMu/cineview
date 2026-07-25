# Contributing to CineView

## Before You Change Code

Read `DESIGN.md` and create a task-flow entry in `task-flows/`. Record the
behavioral acceptance criteria before editing multiple files. Do not introduce
a second writer for render progress, element elapsed time, drag release, or
native scroll offset.

## Local Checks

Use pnpm 10 and Node.js 18 or newer:

```bash
pnpm install
pnpm verify
pnpm --dir site build
pnpm --dir examples/performance-test build
```

Changes to drag or scroll behavior also require a real browser run against the
example routes. Unit tests, type-checking, and a successful build do not replace
that acceptance.

## Pull Requests

Explain the user-visible behavior, ownership impact, and runtime cost of the
change. Include focused regression tests. Keep formatting, type-checking,
linting, coverage, duplicate-code, package-build, and failure-injection checks
green. Do not include generated coverage, browser screenshots, or local build
artifacts unless the task explicitly requires them.

## Commit Scope

Prefer small commits with one reason to change. Public API changes must update
the README, site Docs, declarations through the build, and `CHANGELOG.md`.
