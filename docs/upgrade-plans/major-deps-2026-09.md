# Major Dependency Upgrades Research (Sept 2026)

**Status**: Research completed, execution deferred  
**Research date**: 2026-09-02  
**Workflow ID**: wojke1sh5  

## Target Upgrades

| Package | Current | Target | Risk Level |
|---------|---------|--------|------------|
| TypeScript | ^5.0.0 | ^7.0.2 | High |
| React | ^18.0.0 | ^19.2.8 | High |
| React DOM | ^18.0.0 | ^19.2.8 | High |
| framer-motion | ^11.0.0 | ^13.2.0 | Critical |
| @types/react | ^18.0.0 | ^19.2.18 | Medium |
| @types/react-dom | ^18.0.0 | ^19.2.6 | Medium |
| @testing-library/jest-dom | ^6.0.0 | ^7.0.1 | Low |
| @fast-check/jest | ^1.0.0 | ^2.2.0 | Low |

## Pre-identified Fixes

The research workflow identified 5 code changes needed for TypeScript 7 + React 19 compatibility:

1. **publicApi tests**: Add `--ignoreConfig` flag to fixture compilation (TS7 requirement)
2. **reportedDuplicateScrollZonesRef**: Accept undefined and pass explicit undefined initial value
3. **useSceneScrollTakeover.test.tsx**: Remove unnecessary HTMLElement cast
4. **DragSceneStack.tsx**: Add `<any>` type argument to `React.cloneElement`
5. **useCineViewImperativeApi.ts**: Add `as any` cast to `scenesRef.current` in preload function

## Breaking Changes Summary

### TypeScript 5→7 (42 breaking changes)

**Critical default changes (TS 6.0)**:
- `strict` defaults to `true` (was `false`)
- `module` defaults to `esnext` (was `commonjs`)
- `target` defaults to `es2025` (was `es5`)
- `types` defaults to `[]` (was auto-include all `@types`)
- `rootDir` defaults to `.` (was inferred)
- `noUncheckedSideEffectImports` defaults to `true`

**TS 7.0 enforcement**:
- `stableTypeOrdering` true by default, cannot be disabled
- Builds with tsconfig.json cannot accept file paths without `--ignoreConfig`
- JavaScript analysis reworked (values cannot be used where types expected)
- Template literal types preserve Unicode code points naturally

**Current tsconfig.json implications**:
- Uses `target: ES2020` (TS6+ defaults to ES2025, verify browser compatibility)
- Does not declare `types` array (TS6+ defaults to `[]`, may need `types: ["node", "jest"]`)

### React 18→19

**Breaking changes**:
- `act()` import path: `react-dom/test-utils` → `react`
  - Migration: `npx codemod@latest react/19/replace-act-import`
- ref callbacks with implicit returns rejected in TypeScript
  - `ref={r => (x = r)}` becomes `ref={r => {x = r}}`
- StrictMode no longer double-invokes effects in development
  - Test spy call count assertions may fail

### framer-motion 11→13

**v11.0.0**:
- Velocity calculation changed (frame-level, not per-update)
- Post-mount render moved to microtask (tests must await animation frame)

**v11.17.0**:
- `exitBeforeEnter` removed from AnimatePresence
  - Migration: use `mode='wait'` instead

**v12.0.0**:
- Gesture callbacks signature changed
  - `onHoverStart={(event, info) => {}}` becomes `onHoverStart={(element, event, info) => {}}`

**v12.5.0**:
- framer-motion-3d package removed (3D functionality no longer supported)

**v13.0.0**:
- `@emotion/is-prop-valid` removed as optional dependency
  - If using styled-components/emotion: wrap app in `<MotionConfig isValidProp={isPropValid}>`

## Upgrade Script

The workflow generated an 8-step sequential upgrade script with verification gates:

```bash
#!/usr/bin/env bash
set -e

# Step 1: @testing-library/jest-dom ^6.0.0 → ^7.0.1 (risk: low)
pnpm add -D @testing-library/jest-dom@^7.0.1
pnpm type-check:framework && pnpm test:unit:framework --passWithNoTests

# Step 2: @fast-check/jest ^1.0.0 → ^2.2.0 (risk: low)
pnpm add -D @fast-check/jest@^2.2.0
pnpm type-check:framework && pnpm test:unit:framework --passWithNoTests

# Step 3: typescript ^5.0.0 → ^7.0.2 (risk: high)
pnpm add -D typescript@^7.0.2
pnpm type-check:framework && pnpm test:unit:framework --passWithNoTests

# Step 4: @types/react ^18.0.0 → ^19.2.18 (risk: medium)
pnpm add -D @types/react@^19.2.18
pnpm type-check:framework && pnpm test:unit:framework --passWithNoTests

# Step 5: @types/react-dom ^18.0.0 → ^19.2.6 (risk: medium)
pnpm add -D @types/react-dom@^19.2.6
pnpm type-check:framework && pnpm test:unit:framework --passWithNoTests

# Step 6: react ^18.0.0 → ^19.2.8 (risk: high)
pnpm add -D react@^19.2.8
pnpm type-check:framework && pnpm test:unit:framework --passWithNoTests

# Step 7: react-dom ^18.0.0 → ^19.2.8 (risk: high)
pnpm add -D react-dom@^19.2.8
pnpm type-check:framework && pnpm test:unit:framework --passWithNoTests

# Step 8: framer-motion ^11.0.0 → ^13.2.0 (risk: critical)
pnpm add -D framer-motion@^13.2.0
pnpm type-check:framework && pnpm test:unit:framework --passWithNoTests
```

## Research Cost

- **Agents**: 6 parallel
- **Tokens**: 467K subagent tokens
- **Tool uses**: 403
- **Duration**: 78 minutes (wall clock)

## Recommendation

**Defer execution to dedicated node (N9)**. Rationale:

1. **Scope**: 3 critical packages spanning 2-3 major versions each
2. **Risk**: Workflow's 5 pre-identified fixes may not be exhaustive
3. **Context**: N8 is "收尾" (wrap-up); major upgrades exceed that scope
4. **Current state**: All 1620 tests green, system stable

The research provides a complete foundation for execution when the user prioritizes it.

## Full Workflow Output

Located at: `$CLAUDE_PROJECTS/.../tasks/wojke1sh5.output`  
Journal: `$CLAUDE_PROJECTS/.../subagents/workflows/wf_298f01d1-646/journal.jsonl`
