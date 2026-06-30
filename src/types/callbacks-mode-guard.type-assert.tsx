/**
 * Compile-time guard for the flat, mode-aware callbacks API (see CineViewProps).
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
import { CineView, Scene } from '../index';
import type {
  CineViewProps,
  DragModeCallbacks,
  ScrollModeCallbacks,
  CineViewDesignConfig,
} from '../index';

const config: CineViewDesignConfig = { width: 750, height: 1334 };

// --- Positive: the per-mode flat callbacks are accepted ---------------------
const dragOk: DragModeCallbacks = {
  onSceneDidChange: () => {},
  onDragStart: () => {},
  onDragCommit: () => {},
};
const scrollOk: ScrollModeCallbacks = {
  onSceneDidChange: () => {},
  onZoneProgress: () => {},
};

// --- Positive: assignable to CineViewProps in the matching mode -------------
const dragProps: CineViewProps = {
  config,
  mode: 'drag',
  callbacks: { onDragCommit: () => {}, onSceneDidChange: () => {} },
  children: null,
};
const scrollProps: CineViewProps = {
  config,
  mode: 'scroll',
  callbacks: { onZoneProgress: () => {}, onSceneDidChange: () => {} },
  children: null,
};
// mode omitted defaults to drag — drag callbacks accepted.
const defaultModeProps: CineViewProps = {
  config,
  callbacks: { onDragCommit: () => {} },
  children: null,
};

// --- Negative: a scroll callback in drag mode must be rejected --------------
// The `?: never` cross-exclusion surfaces the incompatibility on the whole-object
// assignment, so the directive sits on the `const` line (not the `callbacks:` line).
// @ts-expect-error onZoneProgress is not a drag-mode callback
const dragWithScrollCb: CineViewProps = {
  config,
  mode: 'drag',
  callbacks: { onZoneProgress: () => {} },
  children: null,
};

// --- Negative: a drag callback in scroll mode must be rejected --------------
// @ts-expect-error onDragCommit is not a scroll-mode callback
const scrollWithDragCb: CineViewProps = {
  config,
  mode: 'scroll',
  callbacks: { onDragCommit: () => {} },
  children: null,
};

// --- Negative: same guard at the JSX boundary -------------------------------
export function DragModeScrollCallbackJsx(): JSX.Element {
  return (
    // @ts-expect-error onZoneProgress is not valid in drag mode
    <CineView config={config} mode="drag" callbacks={{ onZoneProgress: () => {} }}>
      <Scene>drag</Scene>
    </CineView>
  );
}

export function ScrollModeDragCallbackJsx(): JSX.Element {
  return (
    // @ts-expect-error onDragCommit is not valid in scroll mode
    <CineView config={config} mode="scroll" callbacks={{ onDragCommit: () => {} }}>
      <Scene>scroll</Scene>
    </CineView>
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
  onDragCommit: (): void => {},
  onZoneProgress: (): void => {},
};
const dragWithExtractedMixedCb: CineViewProps = {
  config,
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
