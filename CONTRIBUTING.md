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
pnpm docs:links
pnpm audit:all
pnpm --dir site build
pnpm --dir examples/performance-test build
```

Changes to drag or scroll behavior also require a real browser run against the
example routes. Unit tests, type-checking, and a successful build do not replace
that acceptance.

## Running examples and the website

After installing the dependencies listed in Local Checks, build the library and start a consumer:

```bash
pnpm build
pnpm --dir examples/minimal dev
```

For the bilingual website and documentation:

```bash
pnpm --dir site dev
```

Use the address printed by Vite. The website serves the scroll demonstration at `/`, the drag demonstration at `/drag`, and documentation at `/docs`. Rebuild the root package after framework changes; both consumers use the built package.

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
green. Do not include generated coverage, browser screenshots, or local build
artifacts unless the task explicitly requires them.

## Commit Scope

Prefer small commits with one reason to change. Public API changes must update
the README, site Docs, declarations through the build, and `CHANGELOG.md`.
