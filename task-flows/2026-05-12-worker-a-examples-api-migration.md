# Task: Worker A Examples API Migration

## Goal

- Update example apps and example READMEs under `examples/simple-test/**`, `examples/drag-mode-test/**`, and `examples/performance-test/**`
- Prefer the final recommended public API:
  - root `mode`
  - `config.width` / `config.height`
  - grouped `Position.at` / `Position.layer`
  - grouped `Animate.duration` / `Animate.timeline`
  - grouped `Scene` props where it clearly improves deprecated usage
  - avoid public `Viewport` recommendation language

## Nodes

- [x] Read project rules, self-review log, design, requirements, and active Phase 7/8 flow
- [x] Audit legacy API usage across the three example folders
- [ ] Migrate `examples/simple-test/**`
- [ ] Migrate `examples/drag-mode-test/**`
- [ ] Migrate `examples/performance-test/**`
- [ ] Update example READMEs / guides to the final recommended API wording
- [ ] Run focused verification for the changed examples
- [ ] Record remaining intentional legacy usage

## Verification Checklist

- [ ] `rg` audit shows the targeted files no longer rely on obvious deprecated primary-path props where migration is practical
- [ ] Example builds pass for changed apps
- [ ] Remaining legacy usage is documented explicitly

## Risks / Blockers

- `examples/performance-test/**` is broad and may contain intentionally historical probes; any leftover legacy usage needs to be called out instead of silently normalized.

## Current Status

- In progress: migrate the three owned example areas without reverting concurrent edits.
