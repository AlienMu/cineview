# Cineview agent instructions

This file is the repository guide for coding agents. Read it before making code or documentation changes.

## Source of truth

- Read [`DESIGN.md`](./DESIGN.md) before changing runtime behavior. It is the current architecture specification.
- Create or update a local task-flow file in `task-flows/` before a multi-file change. Record the nodes and check them as they finish. This directory is ignored and must not be committed.
- Treat the current TypeScript source and public type declarations as authoritative. Historical review notes describe past states and do not override code.
- The site writing rules are in [`site/src/content/docs/WRITING.md`](./site/src/content/docs/WRITING.md).

## Repository map

- `src/components/Cineview`: mode entry points and scroll controller
- `src/components/Scene`: scene lifecycle, layout, and scroll-zone contexts
- `src/components/Animate`: animation semantics and mode-specific drivers
- `src/components/Position`, `src/components/Container`, `src/components/Image`: layout, sizing, and image loading
- `src/context/CineviewContext.tsx`: width-based conversion values
- `src/types/index.ts`: public types
- `site/src/content/docs`: bilingual documentation pages

## Runtime rules

- `mode` is `drag` or `scroll`. `timeline.driver` is `scene` or `clock`.
- `designWidth` is the only responsive conversion base. Conversion follows viewport width.
- In drag mode, `renderProgress` is written by the render path and each Scene owns its element elapsed MotionValue. Do not add a second writer or share mutable progress between Scenes.
- In scroll mode, a valid `Scene.scroll` zone owns its zone progress. One millisecond of authored zone duration equals one pixel of real scroll distance.
- Per-frame values use MotionValues or the existing external stores. Do not add per-frame React state updates, layout reads followed by writes, or memo dependencies that change every frame.
- Fixed layers belong to their Scene. Cross-scene persistent UI belongs outside `Cineview`.

## Documentation rules

- Keep English and Chinese page trees, slugs, section counts, and frontmatter eyebrows aligned.
- State the user-visible behavior before explaining implementation details.
- For documentation, use task-oriented writing and progressive disclosure: explain what the reader can do, show a usable example, then provide API details. Check code examples against current types and runtime behavior.
- Use short paragraphs and direct verbs. Use API names and code identifiers only where they help the reader configure or diagnose behavior.
- Do not use physical metaphors or generated-sounding filler in user-facing prose. Avoid the banned vocabulary listed in `WRITING.md`, including `lane`, `root cause`, `bypass`, `takeover` as a general explanation, and the Chinese equivalents listed there. DOM attribute names and API identifiers are allowed in code examples and tables.
- Troubleshooting pages use two parts: what the reader observes, then what to change. Do not use `Symptom / Mechanism / Resolution` or `现象 / 机理 / 修复方案` labels.
- Keep README claims tied to current package metadata and verified commands. Do not present historical test counts as a release guarantee.

## Code interface preference

- When providing runnable code, prefer an importable function called with ordinary function arguments.
- Do not make `argparse`, CLI flags, or shell parameters the main interface unless the user explicitly requests a command-line tool.

## Response and decision style

- Evaluate and rank solutions before responding. If one solution is clearly best, present only that solution. Otherwise present at most the three strongest options, each with its conclusion, decisive reason, and necessary execution steps.
- Do not present one solution and then append a more strongly recommended alternative. Do not list lower-priority options or theoretical edge cases for completeness unless the user requests an exhaustive analysis or comparison.
- For a question that needs continued work, give one recommended next step.
- Execute implementation directly when the goal, scope, and action are settled. Follow the collaboration protocol when a material ambiguity, consequential choice, destructive or irreversible operation, global behavior, real external target, or high-cost change remains unresolved.

## Sub-agent use

- Use sub-agents when independent context, parallel investigation, or independent validation materially improves the work. Handle simple, local tasks directly. Do not create agents merely because a task is large.
- After starting a sub-agent, wait for its result before doing more investigation or starting another work item. Keep one work item running at a time to limit request rate.
- Prefer sub-agents for exploration, investigation, independent review, and test analysis. Keep edits to the same or closely related code under one owner.
- Treat sub-agent findings as evidence. The primary agent owns the final decision, conflict resolution, edits, and acceptance. Resolve disagreements against source, tests, and repository constraints rather than voting or averaging conclusions.
- Follow any user limit or request on agent use. Otherwise choose the scheduling without asking. For ordinary exploration, search, code location, and information organization, prefer `gpt-5.6-luna` with `reasoning_effort=max` when the tool supports it. Use the primary model or a stronger one for complex reasoning, architecture decisions, difficult debugging, or high-reliability review. If the preferred model is unavailable, use an available model without creating a custom role.
- Each time a sub-agent is called, tell the user its model and reasoning effort.

## Avoid overengineering

- Do not add hashes, frozen contracts, baselines, gates, or other defensive mechanisms by default. Add one only for a concrete failure scenario that existing Git, types, tests, validation, rollback, or other ordinary engineering mechanisms do not cover.
- Prefer existing engineering capabilities. Simplify duplicate checks or state when an equivalent mechanism already covers the behavior, and explain why.
- Do not turn ordinary quality, compatibility, or defensive-programming concerns into security issues. Preserve real protections for authentication, authorization, sensitive data, irreversible operations, and formal releases.

## Critical thinking

- When the user proposes a plan, judgment, design, or decision, first check for a false premise, major cost, or clearly better option. Raise the one to three issues that materially affect the choice.
- If the proposal stands after examination, state why it is recommended. Distinguish a workable option from the recommended one. Do not disagree just to appear critical.

## Collaboration protocol

- When the goal, scope, deliverable, execution method, or authorization is unclear, or materially different choices would change the result, fully read and follow [`collaboration-protocol.md`](./collaboration-protocol.md) before dependent work. The same applies to destructive or irreversible actions, global behavior, real external targets, and high-cost changes. This is a required rule, not optional guidance.
- A clear, local, fully scoped instruction does not require confirmation merely because it writes a file or changes the environment.

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

Use `pnpm verify:framework:static` for the framework static gate. Use `pnpm verify:all` only when browser acceptance is available. `cineview` is published on npm. Use `npm pack --dry-run --ignore-scripts` and `npm view cineview` as release checks, not install prerequisites.

## Browser acceptance

Unit tests, type-checking, lint, and static builds do not prove drag or scroll behavior. For changes to those paths, run a separate browser acceptance pass against the actual site route printed by Vite. Cover forward and reverse movement, large input deltas, keyboard and scrollbar input, fixed layers, and concurrent animations. Record the result in the task-flow or review evidence directory.

## Files and cleanup

- Keep framework and site tests. They provide regression coverage and release gates, and they are excluded from the npm tarball by `package.json.files`.
- Keep review reports, task flows, screenshots, traces, generated measurements, and local agent tooling outside Git tracking. Store new investigation helpers under `review/` or `site/scripts/`. Keep reusable verification scripts and regression tests tracked.
- Preserve local evidence unless cleanup is explicitly requested. Run `pnpm verify:repository` before committing; never force-add ignored files.
- Generated or local-only directories such as `coverage`, `dist`, `.playwright-cli`, `.idea`, and `.DS_Store` can be cleaned when they are untracked or regenerated, but check `git status` first.
- Root `dist/` is required by the linked site and minimal example. Keep it while either consumer is running. After offline cleanup, rebuild it before validating or handing back a development environment; a production deployment check does not verify the local development server.
- Never remove user changes or run destructive Git commands without explicit approval.
