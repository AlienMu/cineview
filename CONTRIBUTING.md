# Contributing to CineView

## Before You Change Code

Read `DESIGN.md` and create a task-flow entry in `task-flows/`. Record the
behavioral acceptance criteria before editing multiple files. Do not introduce
a second writer for render progress, element elapsed time, drag release, or
native scroll offset.

## Local Checks

Use pnpm 10.22.0 and Node.js `^22.22.1 || >=24.0.0` for repository development.
The published library declares Node.js `>=18.0.0` support; the build and lint
tools require the development versions above.

Each project has its own lockfile. Install dependencies in all four directories
before running the checks:

```bash
pnpm install --frozen-lockfile
pnpm --dir site install --frozen-lockfile
pnpm --dir examples/minimal install --frozen-lockfile
pnpm --dir examples/performance-test install --frozen-lockfile
pnpm verify:framework:static
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
