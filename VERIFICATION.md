# Verification snapshot

Local checks for the CineView working tree, recorded on September 8, 2026. These figures describe this run; rerun the commands for another revision or release.

## Framework

Environment: Node.js 22.22.1 and pnpm 10.22.0.

| Check                          | Result                                                     |
| ------------------------------ | ---------------------------------------------------------- |
| `pnpm test:coverage:framework` | 118 suites and 1,582 tests passed                          |
| Statement coverage             | 94.85%                                                     |
| Branch coverage                | 90.22%                                                     |
| Function coverage              | 95.15%                                                     |
| Line coverage                  | 96.27%                                                     |
| `pnpm build:verify`            | 17/17 checks passed, including the packed-package consumer |

The framework coverage command excludes `src/__tests__/site`. The four configured coverage thresholds are 90%. The package build checks export targets, declaration files, peer dependencies, bundle limits, and consumption of the packed artifact.

## Website and documentation

The previous homepage work passed independent desktop/mobile browser acceptance in English and Chinese. Its checks include actual Canvas pixels, forward/reverse movement, large input deltas, keyboard input, scrollbar dragging, fixed layers, concurrent animation, sequencing, loops, reduced motion, and the retained `/drag` entry-view appearance.

The documentation now has a new reading layout, responsive navigation, searchable page/section titles, code-copy controls, and scrollable tables. Current checks:

| Check                              | Result                                                         |
| ---------------------------------- | -------------------------------------------------------------- |
| Site contracts                     | 16 suites and 79 tests passed                                  |
| Rendered documentation style probe | 80 pages; no structural, console, or content-check failures    |
| Type checking                      | Root, framework, site, and both examples passed                |
| Lint                               | Framework and changed docs owners passed                       |
| Production site build              | Passed; existing large-chunk warning remains                   |
| README examples                    | Six TypeScript modules passed against the package declarations |
| Selected documentation examples    | 19 TypeScript modules passed                                   |

The independent Chrome matrix passed 2,206 checks: 80 localized pages, 68 legacy-route redirects, 54 layout cases, 18 in-place resizes, and six language/viewport interaction runs. It verified keyboard focus, search, code copying, table scrolling, translated section links, mobile menus, and reduced-motion behavior. The reviewed source files remained unchanged during the final runs.

## Distribution

`cineview@1.0.0` was published to the public npm registry on September 8, 2026, at 08:30:56 UTC. The `latest` tag resolves to `1.0.0`. A fresh registry download matched the verified release archive byte for byte. The earlier 404 recorded during preparation preceded that publication.

The README now links to the published package and uses live npm and GitHub Actions badges. The coverage figures in this document remain a dated local snapshot; they do not describe the result of another revision or CI run. See the [release record](./task-flows/2026-09-08-git-npm-release.md) for package integrity and publication evidence.

## Review sources

The writing review used [Humanizer](https://github.com/blader/humanizer/blob/9862685f575c65a8247f90369951df1b3416e3d6/SKILL.md) and [Humanizer-zh](https://github.com/op7418/Humanizer-zh/blob/91f3d394db8419c20d67ebe22a96cf8fee0a404b/SKILL.md). Their suggestions were applied as editorial guidance, with the repository's writing rules and current public APIs taking precedence.

An independent review read all 40 English and 40 Chinese documentation pages. All 30 groups of factual, example, and wording issues were corrected against current source and types. Final screenshot and content checks also corrected terminology residue and the scrollbar border-color description in the component tables. A separate README review closed its four installation, wording, and evidence-scope findings. Vale was unavailable; style verification used manual review and the repository's static and rendered probes.
