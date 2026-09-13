/**
 * Compile-time guard for the flat, mode-aware callbacks API (see CineviewProps).
 *
 * This file is NOT a jest test — it carries no runtime assertions. It is picked
 * up by `tsc --noEmit` (tsconfig include: "src") and its job is to FAIL the type
 * check if the mode-discrimination ever regresses. Every `@ts-expect-error`
 * below marks a call the compiler MUST reject; if a future change makes one of
 * them legal, the unused-directive becomes an error and type-check breaks.
 *
 * It is excluded from jest by living outside __tests__ and not matching
 * *.test/*.spec, so it never runs as a test.
 */
import { Cineview, Scene } from '../index';
import type { CineviewProps, DragModeCallbacks, ScrollModeCallbacks } from '../index';

// --- Positive: the per-mode flat callbacks are accepted ---------------------
const dragOk: DragModeCallbacks = {
  onSceneLeave: () => {},
  onDragStart: () => {},
  onDragEnd: () => {},
};
const scrollOk: ScrollModeCallbacks = {
  onSceneLeave: () => {},
  onZoneProgress: () => {},
};

// --- Positive: assignable to CineviewProps in the matching mode -------------
const dragProps: CineviewProps = {
  designWidth: 750,
  mode: 'drag',
  callbacks: { onDragEnd: () => {}, onSceneLeave: () => {} },
  children: null,
};
const scrollProps: CineviewProps = {
  designWidth: 750,
  mode: 'scroll',
  callbacks: { onZoneProgress: () => {}, onSceneLeave: () => {} },
  children: null,
};
// mode omitted defaults to drag — drag callbacks accepted.
const defaultModeProps: CineviewProps = {
  designWidth: 750,
  callbacks: { onDragEnd: () => {} },
  children: null,
};

// --- Negative: a scroll callback in drag mode must be rejected --------------
// The `?: never` cross-exclusion surfaces the incompatibility on the whole-object
// assignment, so the directive sits on the `const` line (not the `callbacks:` line).
// @ts-expect-error onZoneProgress is not a drag-mode callback
const dragWithScrollCb: CineviewProps = {
  designWidth: 750,
  mode: 'drag',
  callbacks: { onZoneProgress: () => {} },
  children: null,
};

// --- Negative: a drag callback in scroll mode must be rejected --------------
// @ts-expect-error onDragEnd is not a scroll-mode callback
const scrollWithDragCb: CineviewProps = {
  designWidth: 750,
  mode: 'scroll',
  callbacks: { onDragEnd: () => {} },
  children: null,
};

// --- Negative: mode-specific config keys on the wrong branch -----------------
const dragWithScrollConfig: CineviewProps = {
  mode: 'drag',
  // @ts-expect-error zoneTrigger is a scroll-mode config key
  zoneTrigger: 'center-lock',
  children: null,
};
// @ts-expect-error firstSceneTimeout is a drag-mode config key
const scrollWithDragConfig: CineviewProps = {
  mode: 'scroll',
  firstSceneTimeout: 1000,
  children: null,
};

// --- Negative: same guard at the JSX boundary -------------------------------
export function DragModeScrollCallbackJsx(): React.JSX.Element {
  return (
    // @ts-expect-error onZoneProgress is not valid in drag mode
    <Cineview designWidth={750} mode="drag" callbacks={{ onZoneProgress: () => {} }}>
      <Scene>drag</Scene>
    </Cineview>
  );
}

export function ScrollModeDragCallbackJsx(): React.JSX.Element {
  return (
    // @ts-expect-error onDragEnd is not valid in scroll mode
    <Cineview designWidth={750} mode="scroll" callbacks={{ onDragEnd: () => {} }}>
      <Scene>scroll</Scene>
    </Cineview>
  );
}

// --- Negative: mixed valid+wrong callback via EXTRACTED VARIABLE ------------
// The excess-property check only fires on inline object literals; a callbacks
// object first assigned to a variable evades it. Before the per-mode `?: never`
// cross-exclusion (see DragModeCallbacks / ScrollModeCallbacks), a variable
// holding a valid drag callback AND a wrong-mode scroll callback slipped through
// (weak-type check passed on the shared property). The `?: never` on each mode's
// foreign keys now rejects it even via a variable.
const extractedMixedCb = {
  onDragEnd: (): void => {},
  onZoneProgress: (): void => {},
};
const dragWithExtractedMixedCb: CineviewProps = {
  designWidth: 750,
  mode: 'drag',
  // @ts-expect-error onZoneProgress (scroll-only) is rejected even via a variable
  callbacks: extractedMixedCb,
  children: null,
};
void dragWithExtractedMixedCb;

// Reference the value-level bindings so they are not "unused" errors.
void dragOk;
void scrollOk;
void dragProps;
void scrollProps;
void defaultModeProps;
void dragWithScrollCb;
void scrollWithDragCb;
void dragWithScrollConfig;
void scrollWithDragConfig;
