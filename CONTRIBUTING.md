# Contributing to Cineview

## Before you change code

Read `DESIGN.md` and create a local task-flow entry in `task-flows/`. Record the
behavioral acceptance criteria before editing multiple files. Each frame-changing
value has one writer (`DESIGN.md`, state ownership); do not add a second one.

Task flows and review evidence are ignored by Git. They belong to the local
working copy and are not required to build or test a fresh checkout.

## Local checks

Use pnpm 10.22.0 and Node.js `^22.22.1 || >=24.0.0` for repository development.
The repository and the site each have a lockfile; install both before running the checks:

```bash
pnpm install --frozen-lockfile
pnpm --dir site install --frozen-lockfile
pnpm verify          # repository scope, format, lint, types, unit tests, build, site checks
pnpm test:browser    # browser checks in Chromium and WebKit
pnpm docs:links
pnpm audit:all
```

Changes to scroll, drag, first-screen or media behavior also need the browser checks and a look at
the affected site page in a real browser. Unit tests, type-checking and a successful build do not
replace them. Do not edit source while `pnpm test:browser` runs: the fixture server reloads changed
modules and the run reports false failures.

Performance changes are measured with `pnpm perf` on an idle machine, against a same-machine run of
the previous build. Real-device changes are checked with `pnpm device` (see `device-test/`).

## Running the website

```bash
pnpm --dir site dev
```

The development command builds the runtime and copies it into `site/public/v2/` before starting
Vite. Use the address it prints: the homepage is at `/`, the drag demo at `/drag/`, the examples at
`/examples/<name>/` and the documentation at `/docs`. After changing the runtime while Vite runs,
run `pnpm build` and `node site/tools/copy-v2-runtime.mjs`.

## Deploying the website

The site is hosted on Cloudflare Pages at [cineview.pages.dev](https://cineview.pages.dev). Its
project name and build output directory are in [site/wrangler.jsonc](./site/wrangler.jsonc).

From the repository root, build the runtime and the site, check Cloudflare authentication, and
deploy:

```bash
pnpm build && pnpm --dir site build
npx wrangler@4.95.0 whoami
npx wrangler@4.95.0 pages deploy --cwd site --branch main
```

If authentication is missing, run `npx wrangler@4.95.0 login` first. Pushing a Git commit does not
deploy the site. The homepage, the drag demo and the examples are static pages; `site/public/_redirects`
sends `/docs` paths to the documentation app. After deployment, check the homepage, `/drag/`,
direct documentation links and media requests on the public domain.

See [Releasing](./RELEASING.md) for publishing the package.

## Pull requests

Explain the user-visible behavior, ownership impact and runtime cost of the change. Include focused
regression tests. Keep formatting, type-checking, linting, unit tests, the package build and the
browser checks green. Keep task flows, historical reports, screenshots, traces, local agent tooling
and build outputs out of commits. Reusable checks and regression tests remain part of the source
repository.

`pnpm verify:repository` rejects tracked files covered by `.gitignore`, including files staged with
`git add -f`. It runs before commits. GitHub Actions workflows are excluded from this repository:
run the verification commands locally before publishing. Save new one-off investigation scripts in
`review/` or `site/scripts/`.

## Commit scope

Prefer small commits with one reason to change. Public API changes must update the README, the site
documentation, the declarations (through the build), the design skill and `CHANGELOG.md`.
