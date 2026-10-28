# Releases and artifact verification

## Published versions

| Version | Date | Contents |
| --- | --- | --- |
| 1.0.0 | 2026-09-08 | The 1.x React API (`CineView` spelling). Tag `npm/v1.0.0` records the verified source commit `ba0adf440c8a52be97db827b02f43089019b1750`. |
| 1.0.1 | 2026-09-27 | The 1.x React API (`Cineview` spelling). |
| 2.0.0 | 2026-10-28 | The custom elements in this repository. Tag `v2.0.0`. |
| 2.0.1 | Not published yet | Fixes to entrances, the first clock activation, clock-driven video, stack masks and first-screen assets. |

The 1.x source is no longer in this repository's working tree; it stays in the Git history before
the 2.0 move. A published version cannot be replaced: a change to the library needs a new version.
Updating the main branch or the website does not update a published tarball.

## Before a new package release

Use the development Node.js and pnpm versions in [Contributing](./CONTRIBUTING.md). Install both
dependency sets with their committed lockfiles, then run:

```bash
pnpm verify
pnpm test:browser
pnpm docs:links
pnpm audit:all
npm pack --dry-run --ignore-scripts
```

The dry run lists the tarball's contents: `dist/` (the module and its chunks, the development
build, `cineview.css`, `head.js`, `surface.json`, the type declarations), `README.md`,
`README.zh-CN.md`, `LICENSE` and `package.json`. Check that nothing else is in it.

Then, on an idle machine, measure performance with `pnpm perf` and compare it with the previous
release's numbers from the same machine, and run the real-device tests in `device-test/` on the
supported browsers. Record the results, the machine and the devices in the release notes.

Update the version and the changelog, and confirm that the exact source commit passed these checks.
Check the registry before publishing; an existing version cannot be replaced.

GitHub Actions workflows are excluded from this repository. Tags record verified source versions;
pushing a tag does not publish a package. The tag must match `package.json`, and the changelog must
contain that version. Never create a release tag on an unverified source commit or move an existing
published tag.

## Publishing

Publish manually from the clean source checkout with an npm account that owns the package:

```bash
npm login --registry https://registry.npmjs.org
npm publish --access public --tag latest --registry https://registry.npmjs.org
```

`prepublishOnly` runs `pnpm verify` first. Use `beta` for prerelease versions and `latest` for
stable versions. Historical `npm/*` tags record artifact correspondence only.

Verify the new registry version and install its tarball in an empty project (an HTML page that loads
`dist/cineview.js`, and a bundler import of `cineview`) before deploying the matching documentation.
A failed package publication must not be described as a completed joint release.
