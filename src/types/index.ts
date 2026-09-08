import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import type { MotionValue } from 'framer-motion';

// ============================================================================
// Basic Types
// ============================================================================

export type SlideDirection = 'x' | 'y';

export type ScrollMode = 'drag' | 'scroll';
/**
 * Scene timeline phase for scroll-mode scenes. `hold` is the steady middle
 * phase between enter and exit; it is NOT a virtual scroll-track coordinate.
 */
export type SceneTimelinePhase = 'before' | 'enter' | 'hold' | 'exit' | 'after';

export type SceneAnchor =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type SceneStackMode = 'replace' | 'cover';

// ============================================================================
// Modern Public API Types
// ============================================================================

export interface DragThresholdConfig {
  minVelocity?: number;
  maxVelocity?: number;
  minRatio?: number;
  maxRatio?: number;
}

export type DragTimelineUnit = 'time' | 'percent';

export interface SceneDragConfig {
  /** Whether this Scene may become the target of a user drag. Defaults to true. */
  enabled?: boolean;
  /** Drag-distance mapping unit. Defaults to `time`. */
  unit?: DragTimelineUnit;
  /**
   * Per-drag-percent scale. `time` means milliseconds; `percent` means percent of
   * this Scene's compiled element timeline. Defaults to 10 / 1 respectively.
   */
  scale?: number;
}

export interface DragModeConfig {
  direction?: SlideDirection;
  transitionDuration?: number;
  threshold?: DragThresholdConfig;
  /** Root default mapping unit for Scene element timelines. */
  unit?: DragTimelineUnit;
  /** Root default mapping scale; interpreted according to `unit`. */
  scale?: number;
  // Max time to wait for first-screen priority images before the first-scene
  // enter animation is allowed to start. On timeout a FIRST_SCENE_TIMEOUT error
  // is emitted; if the consumer does not call preventDefault() the framework
  // falls back to statically placing the first scene at its rest state.
  // Defaults to 3000ms.
  firstSceneTimeout?: number;
}

export interface ScrollModeConfig {
  direction?: SlideDirection;
  zoneTrigger?: 'center-lock';
  sceneSizing?: 'content' | 'screen';
  /** Enable runtime parameter diagnostics for scroll layout and zone geometry. */
  debug?: boolean;
  // Global default enter/exit gate margins (design px) for visibility-driven
  // Animate elements in scroll mode. Per-Animate `visibility.enterMargin` /
  // `exitMargin` override these. Both default to 50.
  enterMargin?: number;
  exitMargin?: number;
}

/**
 * Accessibility configuration.
 *
 * Only one field exists because the other three accessibility behaviors have no
 * configurable space: hiding inactive scenes from assistive technology, announcing
 * scene changes via `aria-live`, and drag keyboard navigation are compliance
 * requirements, not preferences. "Reduce motion" reads from system settings and
 * similarly accepts no component-level override.
 */
export interface A11yConfig {
  /**
   * Accessible name for the drag root container (`aria-label`). Defaults to `'Scenes'`.
   * When multiple CineView instances exist on one page, each must have a unique label
   * so they can be distinguished in screen reader landmark lists.
   */
  label?: string;
}

export interface ScrollbarConfig {
  enabled?: boolean;
  ariaLabel?: string;
  width?: number;
  radius?: number;
  inset?: number;
  trackColor?: string;
  thumbColor?: string;
  thumbHoverColor?: string;
  autoHide?: boolean;
}

export interface SceneChangeDetail {
  fromIndex: number;
  toIndex: number;
  direction?: 'forward' | 'backward' | null;
}

/**
 * Error codes emitted by the framework at runtime. Consumers can switch on `code`
 * in `onError` to get autocomplete and exhaustiveness checking (no longer a bare string).
 *
 * - `EMPTY_SCENES`: CineView has no Scene children (`context.scope` is default),
 *   or a Scene has no children (`context.scope === 'scene'`, includes `sceneIndex`).
 * - `IMAGE_LOAD_FAILED`: Image preload failed.
 * - `FIRST_SCENE_TIMEOUT`: First-screen priority resource wait timed out (recoverable, includes preventDefault).
 * - `INVALID_ANIMATION`: Animate's after points to a nonexistent component.
 * - `CIRCULAR_DEPENDENCY`: Animate's after chain contains a cycle.
 * - `INVALID_COMPONENT_HIERARCHY`: Duplicate animateId or authored scroll zone identity in component tree.
 * - `INVALID_DRAG_CONFIG`: Drag unit / scale / enabled config is invalid (recoverable).
 * - `ANIMATION_ASSET_LOAD_FAILED`: Animation preset asset load failed (retryable).
 */
export type CineViewErrorCode =
  | 'EMPTY_SCENES'
  | 'IMAGE_LOAD_FAILED'
  | 'FIRST_SCENE_TIMEOUT'
  | 'INVALID_ANIMATION'
  | 'CIRCULAR_DEPENDENCY'
  | 'INVALID_COMPONENT_HIERARCHY'
  | 'INVALID_DRAG_CONFIG'
  | 'ANIMATION_ASSET_LOAD_FAILED';

export interface CineViewErrorDetail {
  code: CineViewErrorCode;
  message: string;
  context?: Record<string, unknown>;
  // Present on recoverable errors that have a default framework fallback
  // (e.g. FIRST_SCENE_TIMEOUT). Call it to suppress the default behavior and
  // take over handling in the consumer (e.g. render a retry UI). When not
  // called, the framework proceeds with its default fallback.
  preventDefault?: () => void;
}

export interface DragDetail {
  sceneIndex: number;
  progress: number;
  direction?: 'forward' | 'backward' | null;
}

export interface DragStartDetail extends Omit<DragDetail, 'direction'> {
  direction: 'forward' | 'backward';
}

export interface DragBlockedDetail {
  fromIndex: number;
  targetSceneIndex: number;
  direction: 'forward' | 'backward';
}

export interface DragEndDetail extends DragDetail {
  targetSceneIndex: number;
  elapsedMs: number;
  timelineDurationMs: number;
}

export interface ZoneDetail {
  zoneId: string;
  sceneIndex: number;
}

export interface ZoneProgressDetail extends ZoneDetail {
  progress: number;
}

export interface SceneVisibilityDetail {
  sceneIndex?: number;
  visible: boolean;
  progress: number;
}

// Flat, mode-aware callback surface. The callbacks a consumer may pass are
// determined by `mode`: drag mode exposes common + drag callbacks, scroll mode
// exposes common + scroll callbacks. The three building blocks below are merged
// into the two per-mode flat types, and CineViewProps is a discriminated union
// on `mode` so writing a scroll callback in drag mode (or vice versa) is a type
// error. Internally these are regrouped back into { common, drag, scroll }.
export interface CineViewCommonCallbacks {
  onReady?: (api: CineViewRef) => void;
  onLoadProgress?: (progress: number) => void;
  onSceneEnter?: (detail: SceneChangeDetail) => void;
  onSceneLeave?: (detail: SceneChangeDetail) => void;
  onError?: (detail: CineViewErrorDetail) => void;
}

export interface CineViewDragCallbacks {
  /** Fires only after the first direction-qualified move acquires drag ownership. */
  onDragStart?: (detail: DragStartDetail) => void;
  onDragProgress?: (detail: DragDetail) => void;
  onDragBlocked?: (detail: DragBlockedDetail) => void;
  onDragEnd?: (detail: DragEndDetail) => void;
  onDragCancel?: (detail: DragDetail) => void;
}

export interface CineViewScrollCallbacks {
  onZoneEnter?: (detail: ZoneDetail) => void;
  onZoneLeave?: (detail: ZoneDetail) => void;
  onZoneProgress?: (detail: ZoneProgressDetail) => void;
  onSceneVisibilityChange?: (detail: SceneVisibilityDetail) => void;
}

/**
 * Flat callbacks accepted in drag mode (mode="drag" or omitted).
 *
 * The `[K in keyof CineViewScrollCallbacks]?: never` cross-exclusion closes a
 * discrimination hole: without it, TS's excess-property check only rejects
 * wrong-mode callbacks written as an INLINE object literal. A caller who first
 * extracts callbacks into a variable that mixes a valid drag callback with a
 * scroll-only one (e.g. `{ onDragEnd, onZoneProgress }`) would slip past the
 * check, because a variable is not subject to excess-property checking and the
 * weak-type check is satisfied by the shared valid key. Marking every scroll-only
 * key as optional-`never` makes assigning a real function to it a type error on
 * both the inline and the extracted-variable paths.
 */
export type DragModeCallbacks = CineViewCommonCallbacks &
  CineViewDragCallbacks & { [K in keyof CineViewScrollCallbacks]?: never };
/** Flat callbacks accepted in scroll mode (mode="scroll"). Mirror cross-exclusion of drag-only keys — see DragModeCallbacks. */
export type ScrollModeCallbacks = CineViewCommonCallbacks &
  CineViewScrollCallbacks & { [K in keyof CineViewDragCallbacks]?: never };

/**
 * Back-compat alias. The shape changed from the old nested
 * `{ common, drag, scroll }` to the flat per-mode union, so this is a breaking
 * change at the value level, but the NAME is preserved to avoid breaking
 * type-only imports.
 */
export type CineViewCallbacks = DragModeCallbacks | ScrollModeCallbacks;

// ============================================================================
// Animation Types
// ============================================================================

export type PresetAnimation =
  | 'fade'
  | 'fade-in'
  | 'fade-out'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'zoom-in'
  | 'zoom-out'
  | 'scale-up'
  | 'scale-down'
  | 'rotate'
  | 'rotate-in'
  | 'rotate-out'
  | 'spin'
  | 'flip'
  | 'flip-x'
  | 'flip-y'
  | 'bounce'
  | 'bounce-in'
  | 'bounce-out'
  | 'blink'
  | 'flash'
  | 'pulse'
  | 'shake'
  | 'shake-x'
  | 'shake-y'
  | 'vibrate'
  | 'jello'
  | 'blur-in'
  | 'blur-out'
  | 'focus-in'
  | 'elastic'
  | 'rubber-band'
  | 'wobble'
  | 'swing'
  | 'heartbeat'
  | 'tada'
  | 'wave'
  | 'roll-in'
  | 'roll-out'
  | 'hinge'
  | 'jack-in-the-box';

export interface ParsedAnimationVariant {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
  exit: Record<string, unknown>;
}

export interface CustomAnimation {
  initial?: Record<string, unknown>;
  animate?: Record<string, unknown>;
  exit?: Record<string, unknown>;
}

export interface ComposedAnimation {
  animations: (PresetAnimation | CustomAnimation)[];
  mode: 'sequential' | 'parallel';
  delays?: number[];
}

export type AnimationType = PresetAnimation | CustomAnimation | ComposedAnimation;

// ============================================================================
// Component Props Types
// ============================================================================

/**
 * Shared CineView props, independent of `mode`. Mode-specific fields are added
 * by the per-mode branches below; the `mode`/`callbacks` pair closes the
 * discriminated union so both the callback surface and the mode-specific config
 * fields are constrained by the active mode.
 */
export interface CineViewBaseProps {
  /**
   * Design viewport width baseline (design px). The single site-wide conversion
   * ruler: `scale = viewportWidth / designWidth`. All design lengths (Position
   * coordinates, Container box model, etc.) are multiplied by the same `scale`
   * (width-only, never distorted). Scroll takeover time budget is still settled
   * at `1ms = 1px`; scene absolute spans fall back to measured DOM, without
   * introducing a second height ruler.
   *
   * Aligns with common Figma / design file standards: set to the design file
   * width (default 750, standard mobile viewport), then all design px values
   * are scaled to any viewport from this baseline. No separate height baseline —
   * vertical overflow is left to natural document flow / scroll extension.
   */
  designWidth?: number;
  scrollbar?: false | ScrollbarConfig;
  monitor?: boolean;
  a11y?: A11yConfig;
  children: ReactNode;
}

/** Drag-branch-only config keys cannot appear on scroll root (and vice versa) — same cross-exclusion as callbacks. */
type ScrollOnlyConfigKeys = 'zoneTrigger' | 'sceneSizing' | 'enterMargin' | 'exitMargin' | 'debug';
type DragOnlyConfigKeys =
  'transitionDuration' | 'threshold' | 'unit' | 'scale' | 'firstSceneTimeout';

/**
 * CineView drag branch Props: `mode` defaults to drag. Mode-specific fields are
 * flattened at root level (no `modes.drag` wrapper); scroll-specific fields are
 * excluded as `never`.
 */
export type CineViewDragModeProps = CineViewBaseProps &
  DragModeConfig & {
    mode?: 'drag';
    callbacks?: DragModeCallbacks;
  } & { [K in ScrollOnlyConfigKeys]?: never };

/**
 * CineView scroll branch Props: scroll-specific fields are flattened at root
 * level (no `modes.scroll` wrapper); drag-specific fields are excluded as `never`.
 */
export type CineViewScrollModeProps = CineViewBaseProps &
  ScrollModeConfig & {
    mode: 'scroll';
    callbacks?: ScrollModeCallbacks;
  } & { [K in DragOnlyConfigKeys]?: never };

/**
 * CineView component Props — discriminated on `mode`. Drag mode (the default when
 * `mode` is omitted) accepts common + drag callbacks and flat drag config
 * fields; scroll mode accepts common + scroll callbacks and flat scroll config
 * fields. Passing a callback or config field from the wrong mode is a type
 * error (TS excess-property check on the flat objects).
 */
export type CineViewProps = CineViewDragModeProps | CineViewScrollModeProps;

/**
 * Performance metrics for monitoring runtime behavior.
 */
export interface PerformanceMetrics {
  fps: number;
  avgFrameTime: number;
  memoryUsage?: number;
  bundleSize: number;
}

/**
 * Scene asset preload target.
 * - number: zero-based scene index
 * - string: Scene.sceneId; in scroll mode it can also match Scene.scroll.zoneId
 */
export type CineViewPreloadTarget = number | string;

/**
 * CineView Ref methods.
 *
 * These 5 methods exist in both drag and scroll modes, so they are required —
 * call sites no longer need `ref.current?.refreshLayout?.()` per-method null checks.
 * `goToZone` is scroll-mode-only (drag mode has no zone concept), so it remains optional;
 * scroll consumers can switch to {@link CineViewScrollRef} for a view with `goToZone` required.
 */
export interface CineViewRef {
  goToScene: (index: number, animated?: boolean) => void;
  refreshLayout: () => void;
  preload: (targets?: CineViewPreloadTarget[]) => Promise<void>;
  getCurrentIndex: () => number;
  getPerformanceMetrics: () => PerformanceMetrics;
  /** Scroll mode only: jump to specified zone. Not available in drag mode. */
  goToZone?: (zoneId: string, options?: { align?: 'center'; animated?: boolean }) => void;
}

/**
 * CineView Ref in scroll mode — `goToZone` is required here.
 * Usage: `const ref = useRef<CineViewScrollRef>(null)`, with `mode="scroll"`.
 */
export interface CineViewScrollRef extends CineViewRef {
  goToZone: (zoneId: string, options?: { align?: 'center'; animated?: boolean }) => void;
}

/**
 * Scene component Props
 */
export interface SceneProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  sceneId?: string;
  layout?: {
    width?: number | string;
    height?: number | string;
    anchor?: SceneAnchor;
    overflow?: 'hidden' | 'visible' | 'clip';
    /**
     * Stacking strategy (formerly `stack.mode`): which scene acts as background
     * when this scene and adjacent scenes share the screen.
     * Defaults to 'replace' in drag mode, 'cover' in scroll mode.
     */
    overlap?: SceneStackMode;
    /** Stacking z-order (formerly `stack.zIndex`). */
    zIndex?: number;
  };
  transition?: {
    enterAnimation?: AnimationType;
    exitAnimation?: AnimationType;
    exitDuration?: number;
  };
  assets?: {
    preloadImages?: string[];
  };
  drag?: SceneDragConfig;
  scroll?: {
    zoneId?: string;
    trigger?: 'center-lock';
  };
  callbacks?: {
    onVisibilityChange?: (detail: SceneVisibilityDetail) => void;
  };
  children: ReactNode;
}

/**
 * Animate component Props
 */
interface AnimateBaseProps {
  animateId?: string;
  exitAnimation?: AnimationType;
  duration?: {
    enter?: number;
    exit?: number;
  };
  timeline?: {
    /**
     * Timeline driver. Defaults to `'scene'` (graceful inference):
     *
     * - **`'scene'` + inside a `Scene` with `scroll` takeover config (inherits zoneId)** → driven by
     *   that zone's real scroll budget (progressPx), works with `phase` (scroll takeover).
     * - **`'scene'` + scroll mode but not inside a zone** → gracefully degrades to visibility gate,
     *   triggered by element entering/exiting viewport.
     * - **`'scene'` + drag mode** → driven by Scene's shared element timeline.
     * - **`'clock'` + scroll mode** → forces independent visibility gate, not taken over by zone even when inside one.
     * - **`'clock'` + drag mode** → after Scene officially arrives, plays independently on real clock;
     *   does not participate in Scene registry, `after`, or `T_self`, and ignores `exitAnimation`.
     */
    driver?: 'scene' | 'clock';
    delay?: number;
    /** Wait for a specific animateId to finish before entering. */
    after?: string;
    zoneId?: string;
    phase?: {
      start?: number;
      end?: number;
    };
  };
  visibility?: {
    /** Whether to replay enter animation when element re-enters (formerly `replay`, defaults to true). */
    replay?: boolean;
    // Design-px gap from the viewport edges that gates enter/exit. Enter fires
    // when the element is fully inside the viewport AND its bottom clears the
    // bottom edge by `enterMargin`; exit fires when its top reaches within
    // `exitMargin` of the top edge. Oversized elements (taller than
    // viewport - enterMargin) fall back to a center/70% rule. Both are design
    // px (run through the single-ruler scale) and default to the CineView-level
    // scroll-branch `enterMargin` / `exitMargin`, which default to 50.
    enterMargin?: number;
    exitMargin?: number;
  };

  /**
   * Exposes enter trigger function for manual enter timing control (e.g., show content
   * immediately on async event success).
   *
   * **Behavior rules:**
   * - **Calling `enterRef.current()`**: plays enter animation immediately, interrupting any pending `after`/`delay`.
   * - **Passed `enterRef` + passed `timeline.after/delay`**: if user doesn't call ref, framework will
   *   **fallback trigger** enter after `after`/`delay` completes.
   * - **Passed `enterRef`, but no `after/delay`**: never auto-triggers, must manually call `enterRef.current()` to enter.
   *
   * **Typical use:** Show content immediately on API success, rely on `delay` fallback on failure.
   *
   * @example
   * ```tsx
   * const contentEnterRef = useRef<(() => void) | null>(null);
   *
   * useEffect(() => {
   *   fetch('/api/data')
   *     .then(data => {
   *       setContent(data);
   *       contentEnterRef.current?.(); // success → show immediately
   *     })
   *     .catch(() => {
   *       // failure → don't call ref, wait 3s fallback trigger
   *     });
   * }, []);
   *
   * <Animate
   *   enterRef={contentEnterRef}
   *   timeline={{ delay: 3000 }}  // fallback: show after 3s regardless
   *   enterAnimation="fade-in"
   * >
   *   {content || <EmptyState />}
   * </Animate>
   * ```
   */
  enterRef?: React.MutableRefObject<(() => void) | null>;

  /**
   * Exposes exit trigger function for manual exit timing control.
   *
   * **Behavior rules:**
   * - **Passed `exitRef`**: disables framework's auto-exit mechanism (scroll leaving zone / drag switching scene),
   *   must manually call `exitRef.current()` to exit.
   * - **Calling `exitRef.current()`**: plays exit animation immediately, interrupting any pending enter (if any).
   *
   * **Note:** `exitRef` does not support `timeline.delay` fallback mechanism (exit has no "timeout then auto-exit" semantics).
   *
   * @example
   * ```tsx
   * const modalExitRef = useRef<(() => void) | null>(null);
   *
   * <Animate
   *   exitRef={modalExitRef}
   *   enterAnimation="fade-in"
   *   exitAnimation="fade-out"
   * >
   *   <Modal onClose={() => modalExitRef.current?.()} />
   * </Animate>
   * ```
   */
  exitRef?: React.MutableRefObject<(() => void) | null>;
}

export interface AnimateStaggerConfig {
  each?: number;
  from?: 'first' | 'last' | 'center';
}

type EnterAnimationRequired = {
  enterAnimation: AnimationType;
  loopAnimation?: AnimationType;
};

type LoopOnly = {
  enterAnimation?: never;
  loopAnimation: AnimationType;
};

export type AnimateProps =
  | (AnimateBaseProps &
      EnterAnimationRequired & {
        /**
         * Staggered enter choreography for child elements. When set, each **direct child**
         * of `children` is revealed sequentially by framer's native `staggerChildren`,
         * using `enterAnimation`'s variants (bypasses enter/exit's 10-property whitelist,
         * can animate any framer-animatable property like `clipPath`/`width`).
         *
         * Time-driven, does not scrub with scroll/drag (for scrub-based per-element reveal,
         * use render-prop `enterProgress` instead). Used for visibility enter: typewriter,
         * list cascade, letter wave, etc.
         */
        stagger: AnimateStaggerConfig;
        children: ReactElement;
      })
  | (AnimateBaseProps &
      (EnterAnimationRequired | LoopOnly) & {
        stagger?: never;
        children: ReactNode | ((state: AnimateRenderState) => ReactNode);
      });

/**
 * Render-prop children receives animation state. Progress naturally follows
 * current timeline source: visibility advances by time, scroll/drag scrubs
 * with scroll/drag.
 */
export interface AnimateRenderState {
  enterProgress: number;
  phase: 'idle' | 'waiting' | 'entering' | 'entered' | 'exiting' | 'exited';
}

export type AnimatePhase = AnimateRenderState['phase'];
export type AnimateTimelineLane = 'drag' | 'scroll' | 'visibility';
export type AnimateTimelineSource =
  'idle' | 'gesture' | 'continuation' | 'programmatic' | 'scroll' | 'visibility';

export interface AnimateTimelineFrame {
  progress: number;
  signedProgress: number;
  phase: AnimatePhase;
  source: AnimateTimelineSource;
}

/**
 * Stable, read-only zero-render view of the nearest Animate timeline.
 * MotionValue updates bypass React rendering; the object exposes no writer.
 */
export interface AnimateTimeline {
  readonly mode: ScrollMode;
  /** Public-side timeline.driver normalized to runtime lane ('drag' | 'scroll' | 'visibility'). */
  readonly lane: AnimateTimelineLane;
  readonly progress: MotionValue<number>;
  readonly signedProgress: MotionValue<number>;
  readonly phase: MotionValue<AnimatePhase>;
  /** Atomic progress/phase/ownership snapshot for imperative consumers. */
  readonly frame: MotionValue<AnimateTimelineFrame>;
}

export interface ScrollTimelineState {
  phase: SceneTimelinePhase;
  enterProgress: number;
  exitProgress: number;
  sceneProgress: number;
  rangeStart: number;
  rangeEnd: number;
  rangeLength: number;
  enterLength: number;
  exitLength: number;
}

/**
 * Position component Props
 */
export interface PositionProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'children' | 'style' | 'className'
> {
  at?: {
    x?: number;
    y?: number;
    offsetX?: number;
    offsetY?: number;
    /**
     * Centering anchor. When set, element centers relative to viewport without
     * manually writing `translate(-50%)`:
     * - `'center'`: horizontal + vertical centering
     * - `'center-x'`: horizontal centering only (`y` remains absolute design coordinate)
     * - `'center-y'`: vertical centering only (`x` remains absolute design coordinate)
     *
     * After centering, `x` / `y` become "offset from center" (design px, converted via
     * single-ruler `scale`): e.g. `anchor: 'center', x: 0, y: -100` means horizontally
     * centered, vertically centered then moved up 100. The centered axis ignores
     * `offsetX` / `offsetY` relative positioning chain.
     */
    anchor?: 'center' | 'center-x' | 'center-y';
  };
  /** Scene-scoped fixed layer mount (former `layer: { fixed: true }` wrapper removed). */
  fixed?: boolean;
  children: ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Container component Props — px2vw box model conversion container.
 * width/height and all length values inside style (padding/margin/gap/borderRadius/fontSize/...)
 * are converted from design px via single-ruler `convert`.
 */
export interface ContainerProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'children' | 'style' | 'className'
> {
  width?: number;
  height?: number;
  children: ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export type GestureType = 'swipe-up' | 'swipe-down' | 'swipe-left' | 'swipe-right' | 'none';

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_SLIDE_DURATION = 800;
export const DEFAULT_ANIMATION_DURATION = 600;
