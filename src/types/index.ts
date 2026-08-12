import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import type { MotionValue } from 'framer-motion';

// ============================================================================
// Basic Types
// ============================================================================

/**
 * 滑动方向类型
 */
export type SlideDirection = 'x' | 'y';

/**
 * 滚动模式类型
 */
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

export interface CineViewDesignConfig {
  /**
   * 设计稿尺寸基准（设计 px）。这是全站唯一的换算尺子：
   * `scale = viewportWidth / size`，坐标（Position）、盒模型（Container）等设计长度
   * 全部乘同一个 `scale`（认宽不认高，绝不形变）。scroll takeover 的时间预算仍按
   * `1ms = 1px` 结算；场景绝对跨度回退 DOM 实测，不引入第二把高度尺子。
   *
   * 对齐 Figma / 设计稿的通用标准：填一个设计稿宽度（默认 750，移动端标准稿），
   * 之后所有设计 px 数值都以此为基准换算到任意视口。不再有独立的高度基准——
   * 纵向超出交给自然文档流 / 滚动延展。
   */
  size?: number;
}

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
  // Global default enter/exit gate margins (design px) for visibility-driven
  // Animate elements in scroll mode. Per-Animate `visibility.enterMargin` /
  // `exitMargin` override these. Both default to 50.
  enterMargin?: number;
  exitMargin?: number;
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
 * 框架运行时实际会发出的错误码联合。消费者在 `onError` 里对 `code` 做 switch
 * 时可获得自动补全与穷尽性检查（不再是裸 string）。
 *
 * - `NO_SCENES`：CineView 没有任何 Scene 子节点。
 * - `IMAGE_LOAD_FAILED`：预加载图片失败。
 * - `FIRST_SCENE_TIMEOUT`：首屏优先资源等待超时（可恢复，带 preventDefault）。
 * - `INVALID_ANIMATION`：Animate 的 waitFor 指向不存在的组件。
 * - `CIRCULAR_DEPENDENCY`：Animate 的 waitFor 链存在循环。
 * - `INVALID_COMPONENT_HIERARCHY`：组件树内出现重复的 animateId 或 authored scroll zone identity。
 * - `INVALID_DRAG_CONFIG`：drag unit / scale / enabled 配置非法（可恢复）。
 * - `ANIMATION_ASSET_LOAD_FAILED`：动画预设资源加载失败（可重试）。
 */
export type CineViewErrorCode =
  | 'NO_SCENES'
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

export interface DragCommitDetail extends DragDetail {
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
  onSceneWillChange?: (detail: SceneChangeDetail) => void;
  onSceneDidChange?: (detail: SceneChangeDetail) => void;
  onError?: (detail: CineViewErrorDetail) => void;
}

export interface CineViewDragCallbacks {
  /** Fires only after the first direction-qualified move acquires drag ownership. */
  onDragStart?: (detail: DragStartDetail) => void;
  onDragProgress?: (detail: DragDetail) => void;
  onDragBlocked?: (detail: DragBlockedDetail) => void;
  onDragCommit?: (detail: DragCommitDetail) => void;
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
 * scroll-only one (e.g. `{ onDragCommit, onZoneProgress }`) would slip past the
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

export interface CineViewPerformanceConfig {
  monitor?: boolean;
}

// ============================================================================
// Animation Types
// ============================================================================

/**
 * 预设动画名称类型
 */
export type PresetAnimation =
  // 基础动画
  | 'fade'
  | 'fade-in'
  | 'fade-out'
  // 滑动动画
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  // 缩放动画
  | 'zoom-in'
  | 'zoom-out'
  | 'scale-up'
  | 'scale-down'
  // 旋转动画
  | 'rotate'
  | 'rotate-in'
  | 'rotate-out'
  | 'spin'
  // 翻转动画
  | 'flip'
  | 'flip-x'
  | 'flip-y'
  // 弹跳动画
  | 'bounce'
  | 'bounce-in'
  | 'bounce-out'
  // 闪烁动画
  | 'blink'
  | 'flash'
  | 'pulse'
  // 抖动动画
  | 'shake'
  | 'shake-x'
  | 'shake-y'
  | 'vibrate'
  | 'jello'
  // 模糊动画
  | 'blur-in'
  | 'blur-out'
  | 'focus-in'
  // 弹性动画
  | 'elastic'
  | 'rubber-band'
  | 'wobble'
  | 'swing'
  // 特殊效果
  | 'heartbeat'
  | 'tada'
  | 'wave'
  | 'roll-in'
  | 'roll-out'
  | 'hinge'
  | 'jack-in-the-box';

/**
 * 解析后的动画变体（Framer Motion 格式）
 */
export interface ParsedAnimationVariant {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
  exit: Record<string, unknown>;
}

/**
 * 自定义动画（Framer Motion variant subset）
 */
export interface CustomAnimation {
  initial?: Record<string, unknown>;
  animate?: Record<string, unknown>;
  exit?: Record<string, unknown>;
}

/**
 * 组合动画
 */
export interface ComposedAnimation {
  animations: (PresetAnimation | CustomAnimation)[];
  mode: 'sequential' | 'parallel'; // 顺序执行 | 并行执行
  delays?: number[]; // 每个动画的延迟
}

/**
 * 动画类型（预设、自定义或组合）
 */
export type AnimationType = PresetAnimation | CustomAnimation | ComposedAnimation;

// ============================================================================
// Component Props Types
// ============================================================================

/**
 * Shared CineView props, independent of `mode`. The `mode`/`callbacks` pair is
 * added by the discriminated union below so the callback surface is constrained
 * by the active mode.
 */
export interface CineViewBaseProps {
  /**
   * 设计稿尺寸基准配置。可缺省：缺省时等价于 `{ size: 750 }`（移动端标准稿宽），
   * 即 `scale = viewportWidth / 750`。
   */
  config?: CineViewDesignConfig;
  modes?: {
    drag?: DragModeConfig;
    scroll?: ScrollModeConfig;
  };
  scrollbar?: false | ScrollbarConfig;
  performance?: CineViewPerformanceConfig;
  children: ReactNode;
}

/**
 * CineView 组件 Props — discriminated on `mode`. Drag mode (the default when
 * `mode` is omitted) accepts common + drag callbacks; scroll mode accepts
 * common + scroll callbacks. Passing a callback from the wrong mode is a type
 * error (TS excess-property check on the flat callbacks object).
 */
export type CineViewProps =
  | (CineViewBaseProps & { mode?: 'drag'; callbacks?: DragModeCallbacks })
  | (CineViewBaseProps & { mode: 'scroll'; callbacks?: ScrollModeCallbacks });

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  fps: number; // 当前帧率
  avgFrameTime: number; // 平均帧时间（ms）
  memoryUsage?: number; // 内存使用（MB）
  bundleSize: number; // Bundle 大小（KB）
}

/**
 * Scene asset preload target.
 * - number: zero-based scene index
 * - string: Scene.sceneId; in scroll mode it can also match Scene.scroll.zoneId
 */
export type CineViewPreloadTarget = number | string;

/**
 * CineView Ref 方法。
 *
 * 这 5 个方法在 drag 与 scroll 两种模式下都必定存在，因此为必填——
 * 调用点不再需要 `ref.current?.refreshLayout?.()` 的逐方法判空。
 * `goToZone` 是 scroll 模式专属能力（drag 模式下无 zone 概念），保持可选；
 * scroll 消费者可改用 {@link CineViewScrollRef} 取得 `goToZone` 必填的视图。
 */
export interface CineViewRef {
  goToScene: (index: number, animated?: boolean) => void;
  refreshLayout: () => void;
  preload: (targets?: CineViewPreloadTarget[]) => Promise<void>;
  getCurrentScene: () => number;
  getPerformanceMetrics: () => PerformanceMetrics;
  /** scroll 模式专属：跳转到指定 zone。drag 模式下不提供。 */
  goToZone?: (zoneId: string, options?: { align?: 'center'; animated?: boolean }) => void;
}

/**
 * scroll 模式下的 CineView Ref——`goToZone` 在此为必填。
 * 用法：`const ref = useRef<CineViewScrollRef>(null)`，搭配 `mode="scroll"`。
 */
export interface CineViewScrollRef extends CineViewRef {
  goToZone: (zoneId: string, options?: { align?: 'center'; animated?: boolean }) => void;
}

/**
 * Scene 组件 Props
 */
export interface SceneProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  sceneId?: string;
  layout?: {
    width?: number | string;
    height?: number | string;
    anchor?: SceneAnchor;
    overflow?: 'hidden' | 'visible' | 'clip';
  };
  stack?: {
    mode?: SceneStackMode;
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
 * Animate 组件 Props
 */
interface AnimateBaseProps {
  animateId?: string; // 组件唯一标识
  exitAnimation?: AnimationType; // 离开动画类型（必须与 enter 或 infinite 共存）
  duration?: {
    enter?: number;
    exit?: number;
  };
  timeline?: {
    /**
     * 是否允许场景接管本元素的动画时间轴。默认 `true`（优雅推断）：
     *
     * - **`true` + 位于带 `scroll` 接管配置的 `Scene`（继承到 zoneId）内** → 由该 zone 的
     *   真实滚动预算（progressPx）驱动，可配合 `phase`（scroll 接管）。
     * - **`true` + scroll 模式且不在 zone 内** → 优雅降级为可见性闸门，由元素进出视口触发。
     * - **`true` + drag 模式** → 由 Scene 的共享元素时间轴驱动。
     * - **`false` + scroll 模式** → 强制独立走可见性闸门，即使身处 zone 内也不被接管。
     * - **`false` + drag 模式** → Scene 正式到场后按真实时间独立播放；不参与 Scene registry、
     *   `waitFor` 或 `T_self`，并忽略 `exitAnimation`。
     */
    sceneControlled?: boolean;
    delay?: number;
    waitFor?: string;
    zoneId?: string;
    phase?: {
      start?: number;
      end?: number;
    };
  };
  visibility?: {
    replayOnReenter?: boolean;
    // Design-px gap from the viewport edges that gates enter/exit. Enter fires
    // when the element is fully inside the viewport AND its bottom clears the
    // bottom edge by `enterMargin`; exit fires when its top reaches within
    // `exitMargin` of the top edge. Oversized elements (taller than
    // viewport - enterMargin) fall back to a center/70% rule. Both are design
    // px (run through the single-ruler scale) and default to the CineView-level scroll config
    // (`modes.scroll.enterMargin` / `exitMargin`), which defaults to 50.
    enterMargin?: number;
    exitMargin?: number;
  };

  /**
   * 暴露入场触发函数，用于手动控制入场时机（如异步事件成功时立即显示）。
   *
   * **行为规则：**
   * - **调用 `enterRef.current()` 时**：立即播放入场动画，打断任何正在等待的 `waitFor`/`delay`。
   * - **传了 `enterRef` + 传了 `timeline.waitFor/delay`**：若用户未调用 ref，框架会在 `waitFor`/`delay` 结束后**兜底触发**入场。
   * - **传了 `enterRef`，但未传 `waitFor/delay`**：永远不会自动触发，必须手动调用 `enterRef.current()` 才会入场。
   *
   * **典型用途：** API 请求成功时立即显示内容，请求失败时依赖 `delay` 兜底显示空状态。
   *
   * @example
   * ```tsx
   * const contentEnterRef = useRef<(() => void) | null>(null);
   *
   * useEffect(() => {
   *   fetch('/api/data')
   *     .then(data => {
   *       setContent(data);
   *       contentEnterRef.current?.(); // 成功 → 立即显示
   *     })
   *     .catch(() => {
   *       // 失败 → 不调 ref，等 3 秒兜底触发
   *     });
   * }, []);
   *
   * <Animate
   *   enterRef={contentEnterRef}
   *   timeline={{ delay: 3000 }}  // 兜底：3 秒后无论如何都显示
   *   enterAnimation="fade-in"
   * >
   *   {content || <EmptyState />}
   * </Animate>
   * ```
   */
  enterRef?: React.MutableRefObject<(() => void) | null>;

  /**
   * 暴露退场触发函数，用于手动控制退场时机。
   *
   * **行为规则：**
   * - **传了 `exitRef`**：禁用框架的自动退场机制（scroll 离开 zone / drag 切换 scene），必须手动调用 `exitRef.current()` 才会退场。
   * - **调用 `exitRef.current()` 时**：立即播放退场动画，打断任何正在等待的入场（如果有）。
   *
   * **注意：** `exitRef` 不支持 `timeline.delay` 兜底机制（退场没有"超时后自动退"的语义）。
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
  each?: number; // 每子元素间隔 ms，默认 40
  from?: 'first' | 'last' | 'center'; // 起始方向，默认 'first'
}

type EnterAnimationRequired = {
  enterAnimation: AnimationType;
  infiniteAnimation?: AnimationType;
};

type InfiniteOnly = {
  enterAnimation?: never;
  infiniteAnimation: AnimationType;
};

export type AnimateProps =
  | (AnimateBaseProps &
      EnterAnimationRequired & {
        /**
         * 子元素错峰入场编排。设定后，`children` 的每个**直接子元素**由 framer 原生
         * `staggerChildren` 逐个揭示，各子元素用 `enterAnimation` 的变体（绕过 enter/exit
         * 的 10 属性白名单，可用任意 framer 可动画属性，如 `clipPath`/`width`）。
         *
         * 时间驱动、不随滚动/拖拽 scrub（需要 scrub 的逐元素揭示改用 render-prop 的
         * `enterProgress`）。用于 visibility 入场：打字机、列表级联、字母波浪等。
         */
        stagger: AnimateStaggerConfig;
        children: ReactElement;
      })
  | (AnimateBaseProps &
      (EnterAnimationRequired | InfiniteOnly) & {
        stagger?: never;
        children: ReactNode | ((state: AnimateRenderState) => ReactNode);
      });

/**
 * render-prop children 接收的动画状态。进度天然跟随当前时间轴来源：
 * visibility 按时间推进，scroll/drag 随滚动/拖拽 scrub。
 */
export interface AnimateRenderState {
  enterProgress: number; // 0..1，0=初始帧，1=完全进入
  phase: 'idle' | 'waiting' | 'entering' | 'entered' | 'exiting' | 'exited';
}

export type AnimatePhase = AnimateRenderState['phase'];
export type AnimateTimelineDriver = 'drag' | 'scroll' | 'visibility';
export type AnimateTimelineSource =
  | 'idle'
  | 'gesture'
  | 'continuation'
  | 'programmatic'
  | 'scroll'
  | 'visibility';

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
  readonly driver: AnimateTimelineDriver;
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
 * Position 组件 Props
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
     * 居中锚点。设定后元素相对视口居中，无需再手写 `translate(-50%)`：
     * - `'center'`：水平 + 垂直双向居中
     * - `'center-x'`：仅水平居中（`y` 仍为绝对设计坐标）
     * - `'center-y'`：仅垂直居中（`x` 仍为绝对设计坐标）
     *
     * 居中后 `x` / `y` 改作「相对中心的偏移量」（设计 px，经单尺子 `scale` 换算）：
     * 例如 `anchor: 'center', x: 0, y: -100` 表示水平居中、垂直居中再上移 100。
     * 被居中的轴忽略 `offsetX` / `offsetY` 相对定位链。
     */
    anchor?: 'center' | 'center-x' | 'center-y';
  };
  layer?: {
    fixed?: boolean;
  };
  children: ReactNode;
  style?: React.CSSProperties; // 额外的样式
  className?: string; // CSS 类名
}

/**
 * Container 组件 Props — px2vw 盒模型换算容器。
 * width/height 与 style 内的所有长度量（padding/margin/gap/borderRadius/fontSize/...）
 * 均按设计 px 经单尺子 `convert` 自动换算。
 */
export interface ContainerProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'children' | 'style' | 'className'
> {
  width?: number; // 容器宽度（设计 px）
  height?: number; // 容器高度（设计 px）
  children: ReactNode;
  style?: React.CSSProperties; // 额外样式；数值型长度量按设计 px 换算
  className?: string; // CSS 类名
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * 手势类型
 */
export type GestureType = 'swipe-up' | 'swipe-down' | 'swipe-left' | 'swipe-right' | 'none';

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_SLIDE_DURATION = 800; // 默认滑动动画时间（毫秒）
export const DEFAULT_ANIMATION_DURATION = 600; // 默认动画时长（毫秒）
