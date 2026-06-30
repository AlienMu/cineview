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

const config: CineViewDesignConfig = { width: 750, height: 1334, unit: 'px' };

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
const dragWithScrollCb: CineViewProps = {
  config,
  mode: 'drag',
  // @ts-expect-error onZoneProgress is not a drag-mode callback
  callbacks: { onZoneProgress: () => {} },
  children: null,
};

// --- Negative: a drag callback in scroll mode must be rejected --------------
const scrollWithDragCb: CineViewProps = {
  config,
  mode: 'scroll',
  // @ts-expect-error onDragCommit is not a scroll-mode callback
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

// Reference the value-level bindings so they are not "unused" errors.
void dragOk;
void scrollOk;
void dragProps;
void scrollProps;
void defaultModeProps;
void dragWithScrollCb;
void scrollWithDragCb;
