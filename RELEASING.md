# Releases and artifact verification

## Published 1.0.0

[CineView 1.0.0](https://www.npmjs.com/package/cineview/v/1.0.0) was published on
2026-09-08. The registry did not record a `gitHead` for that publication.
[releases/1.0.0.json](./releases/1.0.0.json) records its tarball URL, integrity,
SHA-256, and the verified source correspondence.

The source is commit `ba0adf440c8a52be97db827b02f43089019b1750`. All 124 distributed
build files match the rebuilt runtime from the main review baseline
`30ae87f4a49b3047a2282bfacae21779fc8a92f1`. Its runtime source, build configuration,
and root lockfile match that source commit. The package metadata, license, and
both README files in the tarball also match the source commit byte for byte.

The annotated tag `npm/v1.0.0` records this verified correspondence. This is a
reconstruction from the published artifact, not an npm provenance attestation.
The older local `v1.0.0` tag points to a different historical commit and is not a
source identifier for the npm artifact. It has been preserved and must not be
published as the release source.

Updating main or the website does not update an already published npm tarball.
Documentation, website, and tooling corrections after publication can be deployed
without republishing 1.0.0. A library change requires a new package version.

## Before a new package release

Use the development Node.js and pnpm versions in [Contributing](./CONTRIBUTING.md).
Install all four dependency sets with their committed lockfiles, then run:

```bash
pnpm verify:all
pnpm docs:links
pnpm audit:all
pnpm --dir examples/performance-test profile:browser
pnpm pack --dry-run
```

Inspect the package contents, update the version and changelog, and confirm that
the exact source commit passed CI and browser acceptance. Check the registry
before publishing; an existing version cannot be replaced.

Future `v*` tags trigger the release workflow. The tag must match `package.json`,
and the changelog must contain that version. Browser acceptance precedes the npm
publish job; the publish command requests npm provenance. Never create a release
tag on an unverified source commit or move an existing published tag.

A historical `npm/*` correspondence tag does not trigger the `v*` publish workflow.
Use it only for verified artifact records, never as a substitute for testing a
new version.

## Production browser profiling

The tracked `examples/performance-test/profile-production.mjs` script builds the
production acceptance fixture, which imports the built library. Run `pnpm build`
first after a library change. Then run:

```bash
pnpm --dir examples/performance-test profile:browser
```

The script serves the fixture on loopback port 4319 and uses installed Chrome,
or `CINEVIEW_CHROME_PATH` when provided. It starts a fresh browser context for each
of three runs, records first contentful paint and readiness, and sends 40 real
wheel events through a scroll fixture with eight concurrent animations per zone.
The JSON report includes the environment, frame intervals, long tasks, errors,
and observed progress events.

The fixture gate allows 2 seconds for first contentful paint, 3 seconds for
readiness, and 200ms for an interaction long task. Missing paint, missing animation
progress, insufficient frame samples, and page errors also fail the gate. These
are regression budgets for this fixture on the test machine, not performance
promises for arbitrary devices, networks, or application content. Frame rate is
reported without a universal 60fps assertion.

`CINEVIEW_PROFILE_RUNS` accepts 1–10. `CINEVIEW_ACC_SKIP_BUILD=1` reuses a verified
fixture build. The browser failure-injection suite sets
`CINEVIEW_PROFILE_INJECT=long-task` to prove that a deliberate 300ms stall fails.
Do not use injected runs as performance measurements.
