## What changed

<!-- One or two sentences. What does this do that the previous code did not? -->

## Why

<!-- The problem being solved. Link an issue if one exists. -->

## Verification

Which gates did you run locally, and what did they say?

- [ ] `pnpm verify:framework:static` — the full headless gate (format, types, lint,
      coverage, duplicates, build, failure injection)
- [ ] `pnpm test:browser` — real-Chrome acceptance, if the change touches drag,
      scroll, or video scrubbing
- [ ] Neither, because: <!-- say why -->

Paste the relevant output rather than describing it. A gate that was not run is
not a gate that passed.

## Public API

- [ ] No public API change
- [ ] Public API changed, and `CHANGELOG.md` records it in this same PR

A rename without a CHANGELOG entry has shipped here before, across 81 doc pages
and every example, leaving the migration recorded nowhere a consumer would look.

## Bundle budget

If this adds runtime code, report the numbers `pnpm build:verify` printed:

| Artifact          | gzip | Budget |
| ----------------- | ---- | ------ |
| `cineview.umd.js` |      | 55 KB  |

The full UMD budget is the tight one. Say so explicitly if this change consumes
the remaining headroom.

## Docs

- [ ] No doc change needed
- [ ] Docs updated in both `site/src/content/docs/en/` and `.../zh/`

The two locales are kept at strict file parity. A page added to one and not the
other is a defect, not a follow-up.
