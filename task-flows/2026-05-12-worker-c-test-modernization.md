# Task: Worker C Focused Test Modernization

## Goal

- Modernize focused tests only within:
  - `src/__tests__/bugfix/**`
  - `src/components/Container/Container.test.tsx`
- Prefer root `mode`, `config.width/config.height`, and newer grouped authoring where straightforward.
- Preserve test intent and avoid touching unrelated migration surfaces.

## Nodes

- [x] Re-read project rules and active migration flow
- [x] Audit target tests for deprecated primary-path usage
- [x] Update `Container.test.tsx` to dual-axis config usage where straightforward
- [x] Update bugfix tests to root-owned mode/config usage where straightforward
- [ ] Run focused tests touched in this worker scope
- [ ] Record residual deprecated fixtures intentionally left in place

## Verification

- [ ] `pnpm exec jest src/components/Container/Container.test.tsx --runInBand`
- [ ] `pnpm exec jest src/__tests__/bugfix/*.test.tsx --runInBand`

## Risks / Blockers

- Some bugfix fixtures may intentionally exercise lower-level legacy/internal context shapes; those should be left in place if changing them would broaden scope.

## Current Status

- In progress: running focused verification on the updated worker-C test surface.
