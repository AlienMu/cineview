# CineView agent instructions

This file is the repository guide for coding agents. Read it before making code or documentation changes.

## Source of truth

- Read [`DESIGN.md`](./DESIGN.md) before changing runtime behavior. It is the current architecture specification.
- Create or update a task-flow file in [`task-flows`](./task-flows) before a multi-file change. Record the nodes and check them as they finish.
- Treat the current TypeScript source and public type declarations as authoritative. Historical review notes describe past states and do not override code.
- The site writing rules are in [`site/src/content/docs/WRITING.md`](./site/src/content/docs/WRITING.md).

## Repository map

- `src/components/CineView`: mode entry points and scroll controller
- `src/components/Scene`: scene lifecycle, layout, and scroll-zone contexts
- `src/components/Animate`: animation semantics and mode-specific drivers
- `src/components/Position`, `src/components/Container`, `src/components/Image`: layout, sizing, and image loading
- `src/context/CineViewContext.tsx`: width-based conversion values
- `src/types/index.ts`: public types
- `site/src/content/docs`: bilingual documentation pages

## Runtime rules

- `mode` is `drag` or `scroll`. `timeline.driver` is `scene` or `clock`.
- `designWidth` is the only responsive conversion base. Conversion follows viewport width.
- In drag mode, `renderProgress` is written by the render path and each Scene owns its element elapsed MotionValue. Do not add a second writer or share mutable progress between Scenes.
- In scroll mode, a valid `Scene.scroll` zone owns its zone progress. One millisecond of authored zone duration equals one pixel of real scroll distance.
- Per-frame values use MotionValues or the existing external stores. Do not add per-frame React state updates, layout reads followed by writes, or memo dependencies that change every frame.
- Fixed layers belong to their Scene. Cross-scene persistent UI belongs outside `CineView`.

## Documentation rules

- Keep English and Chinese page trees, slugs, section counts, and frontmatter eyebrows aligned.
- State the user-visible behavior before explaining implementation details.
- Use short paragraphs and direct verbs. Use API names and code identifiers only where they help the reader configure or diagnose behavior.
- Do not use physical metaphors or generated-sounding filler in user-facing prose. Avoid the banned vocabulary listed in `WRITING.md`, including `lane`, `root cause`, `bypass`, `takeover` as a general explanation, and the Chinese equivalents listed there. DOM attribute names and API identifiers are allowed in code examples and tables.
- Troubleshooting pages use two parts: what the reader observes, then what to change. Do not use `Symptom / Mechanism / Resolution` or `现象 / 机理 / 修复方案` labels.
- Keep README claims tied to current package metadata and verified commands. Do not present historical test counts as a release guarantee.

## Verification commands

```bash
pnpm type-check:framework
pnpm lint
pnpm test:coverage:framework
pnpm build:verify
pnpm test:site-contracts
pnpm type-check:site
pnpm --dir site build
```

Use `pnpm verify:framework:static` for the framework static gate. Use `pnpm verify:all` only when browser acceptance is available. The package is not published yet, so `pnpm pack --dry-run` and `npm view cineview` are release checks, not install prerequisites.

## Browser acceptance

Unit tests, type-checking, lint, and static builds do not prove drag or scroll behavior. For changes to those paths, run a separate browser acceptance pass against the actual site route printed by Vite. Cover forward and reverse movement, large input deltas, keyboard and scrollbar input, fixed layers, and concurrent animations. Record the result in the task-flow or review evidence directory.

## Files and cleanup

- Keep framework and site tests. They provide regression coverage and release gates, and they are excluded from the npm tarball by `package.json.files`.
- Do not delete `site/review`, `review`, `output`, or `task-flows` without explicit scope; they contain acceptance evidence or task history.
- Generated or local-only directories such as `coverage`, `dist`, `.playwright-cli`, `.idea`, and `.DS_Store` can be cleaned when they are untracked or regenerated, but check `git status` first.
- Never remove user changes or run destructive Git commands without explicit approval.
