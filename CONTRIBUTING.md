# Contributing to Cineview

## Before You Change Code

Read `DESIGN.md` and create a local task-flow entry in `task-flows/`. Record the
behavioral acceptance criteria before editing multiple files. Do not introduce
a second writer for render progress, element elapsed time, drag release, or
native scroll offset.

Task flows and review evidence are ignored by Git. They belong to the local
working copy and are not required to build or test a fresh checkout.

## Local Checks

Use pnpm 10.22.0 and Node.js `^22.22.1 || >=24.0.0` for repository development.
The published library declares Node.js `>=18.0.0` support; the build and lint
tools require the development versions above.

Each project has its own lockfile. Install dependencies in all three directories
before running the checks:

```bash
pnpm install --frozen-lockfile
pnpm --dir site install --frozen-lockfile
pnpm --dir examples/minimal install --frozen-lockfile
pnpm verify:framework:static
pnpm docs:links
pnpm audit:all
pnpm --dir site build
pnpm --dir examples/minimal build
pnpm --dir site build:acceptance
```

Changes to drag or scroll behavior also require a real browser run against the
production acceptance routes. Run `pnpm test:browser`,
`pnpm verify:browser-failure-injection`, and `pnpm profile:browser`. Unit tests, type-checking, and a successful build do not replace
that acceptance.

## Running examples and the website

After installing the dependencies listed in Local Checks, start a consumer:

```bash
pnpm --dir examples/minimal dev
```

For the bilingual website and documentation:

```bash
pnpm --dir site dev
```

Both development commands build the framework before starting Vite, including on a fresh checkout without `dist/`. Use the address printed by Vite. The website serves the scroll demonstration at `/`, the drag demonstration at `/drag`, and documentation at `/docs`. Rebuild the root package with `pnpm build` after framework changes made while Vite is running; both consumers use the built package.

Keep the root `dist/` directory while either consumer is running: its files are the linked package's runtime and type declarations. Coverage reports, screenshots, and temporary probes can be cleaned separately. If `dist/` is removed while the servers are stopped, the next development command rebuilds it automatically.

## Deploying the website

The official site is hosted on Cloudflare Pages at [cineview.pages.dev](https://cineview.pages.dev). Its project name and build output directory are configured in [site/wrangler.jsonc](./site/wrangler.jsonc).

From the repository root, build the library and website, verify Cloudflare authentication, and deploy:

```bash
pnpm --dir site build:cf
npx wrangler@4.95.0 whoami
npx wrangler@4.95.0 pages deploy --cwd site --branch main
```

If authentication is missing, run `npx wrangler@4.95.0 login` first. The deploy command uploads a local build to the production branch. Pushing a Git commit does not deploy the site automatically.

The site uses [Cloudflare Pages' default SPA handling](https://developers.cloudflare.com/pages/configuration/serving-pages/). Keep the build free of a top-level `404.html` so direct visits to React Router paths receive the application entry page.

Before deploying, run the site type check and documentation contracts. After deployment, verify the homepage, `/drag`, direct documentation links, and media requests on the public domain. Keep credentials in Wrangler's local login storage or the execution environment.

See [Releasing](./RELEASING.md) for published artifact records and production browser profiling.

## Pull Requests

Explain the user-visible behavior, ownership impact, and runtime cost of the
change. Include focused regression tests. Keep formatting, type-checking,
linting, coverage, duplicate-code, package-build, and failure-injection checks
green. Keep task flows, historical reports, generated coverage, screenshots,
traces, local agent tooling, and build outputs out of commits. Reusable checks
and regression tests remain part of the source repository.

`pnpm verify:repository` rejects tracked files covered by `.gitignore`, including
files staged with `git add -f`. It runs before commits and in the local static gate.
GitHub Actions workflows are excluded from this repository. Run the verification
commands locally before publishing; pushing commits or tags does not publish a package.
Save new one-off investigation scripts in `review/` or `site/scripts/`.

## Commit Scope

Prefer small commits with one reason to change. Public API changes must update
the README, site Docs, declarations through the build, and `CHANGELOG.md`.
