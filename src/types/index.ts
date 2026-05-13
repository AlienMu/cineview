import { ReactNode } from 'react';

// ============================================================================
// Basic Types
// ============================================================================

/**
 * 尺寸单位类型
 */
export type SizeUnit = 'px' | 'rem' | 'vw';

/**
 * 滑动方向类型
 */
export type SlideDirection = 'x' | 'y';

/**
 * 滚动模式类型
 */
export type ScrollMode = 'snap' | 'drag' | 'scroll';
export type VirtualScrollPhase = 'before' | 'enter' | 'hold' | 'exit' | 'after';

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

export type RuntimeState = 'inactive' | 'entering' | 'active' | 'exiting' | 'covered' | 'parked';

// ============================================================================
// Modern Public API Types
// ============================================================================

export interface CineViewDesignConfig {
  /**
   * Preferred modern API.
   * Design draft width.
   */
  width?: number;
  /**
   * Preferred modern API.
   * Design draft height.
   */
  height?: number;
  unit?: SizeUnit;
}

export interface SnapModeConfig {
  direction?: SlideDirection;
  duration?: number;
  replayOnReenter?: boolean;
}

export interface DragThresholdConfig {
  minVelocity?: number;
  maxVelocity?: number;
  minRatio?: number;
  maxRatio?: number;
  reboundDuration?: number;
}

export interface DragModeConfig {
  direction?: SlideDirection;
  transitionDuration?: number;
  threshold?: DragThresholdConfig;
}

export interface ScrollModeConfig {
  direction?: SlideDirection;
  zoneTrigger?: 'center-lock';
  replayOnReenter?: boolean;
  wheelStep?: number;
  touchStep?: number;
  sceneSizing?: 'content' | 'screen';
}

export interface ScrollbarConfig {
  enabled?: boolean;
  strategy?: 'native' | 'overlay';
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

export interface InteractionStateDetail {
  mode: ScrollMode;
  dragging?: boolean;
  scrolling?: boolean;
  animating?: boolean;
}

export interface LayoutMeasuredDetail {
  sceneIndex?: number;
  width?: number;
  height?: number;
}

export interface CineViewErrorDetail {
  code: string;
  message: string;
  context?: Record<string, unknown>;
}

export interface DragDetail {
  sceneIndex: number;
  progress: number;
  direction?: 'forward' | 'backward' | null;
}

export interface DragCommitDetail extends DragDetail {
  targetSceneIndex: number;
  elapsedMs?: number;
  timelineDurationMs?: number;
}

export interface ZoneDetail {
  zoneId: string;
  sceneIndex: number;
}

export interface ZoneProgressDetail extends ZoneDetail {
  progress: number;
  budget?: number;
}

export interface SceneVisibilityDetail {
  sceneIndex?: number;
  visible: boolean;
  progress: number;
}

export interface CineViewCallbacks {
  common?: {
    onReady?: (api: CineViewRef) => void;
    onLoadProgress?: (progress: number) => void;
    onSceneWillChange?: (detail: SceneChangeDetail) => void;
    onSceneDidChange?: (detail: SceneChangeDetail) => void;
    onInteractionStateChange?: (detail: InteractionStateDetail) => void;
    onLayoutMeasured?: (detail: LayoutMeasuredDetail) => void;
    onError?: (detail: CineViewErrorDetail) => void;
  };
  snap?: {
    onTransitionStart?: (detail: SceneChangeDetail) => void;
    onTransitionEnd?: (detail: SceneChangeDetail) => void;
  };
  drag?: {
    onDragStart?: (detail: DragDetail) => void;
    onDragProgress?: (detail: DragDetail) => void;
    onDragCommit?: (detail: DragCommitDetail) => void;
    onDragCancel?: (detail: DragDetail) => void;
  };
  scroll?: {
    onZoneEnter?: (detail: ZoneDetail) => void;
    onZoneLeave?: (detail: ZoneDetail) => void;
    onZoneProgress?: (detail: ZoneProgressDetail) => void;
    onSceneVisibilityChange?: (detail: SceneVisibilityDetail) => void;
  };
}

export interface CineViewPerformanceConfig {
  preset?: 'balanced' | 'smooth' | 'strict';
  virtualization?: 'auto' | 'off';
  measurement?: 'observer' | 'manual';
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
  | 'jack-in-the-box'
  // 无动画
  | 'none';

/**
 * 解析后的动画变体（Framer Motion 格式）
 */
export interface ParsedAnimationVariant {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
  exit: Record<string, unknown>;
}

/**
 * 自定义动画（Web Animations API 格式）
 */
export interface CustomAnimation {
  keyframes: Keyframe[] | PropertyIndexedKeyframes;
  options?: KeyframeAnimationOptions;
  duration?: number;
  easing?: string;
  delay?: number;
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
 * CineView 组件 Props
 */
export interface CineViewProps {
  config: CineViewDesignConfig;
  mode?: ScrollMode;
  modes?: {
    snap?: SnapModeConfig;
    drag?: DragModeConfig;
    scroll?: ScrollModeConfig;
  };
  scrollbar?: false | ScrollbarConfig;
  callbacks?: CineViewCallbacks;
  performance?: CineViewPerformanceConfig;
  children: ReactNode;
}

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
 * CineView Ref 方法
 */
export interface CineViewRef {
  getState?: () => CineViewRuntimeSnapshot;
  goToScene: (index: number, animated?: boolean) => void;
  goToSceneAdvanced?: (
    target: number | string,
    options?: { animated?: boolean; align?: 'start' | 'center' }
  ) => void;
  goToZone?: (zoneId: string, options?: { align?: 'center'; animated?: boolean }) => void;
  refreshLayout?: () => void;
  preload?: (targets?: Array<number | string>) => Promise<void>;
  getCurrentScene: () => number;
  getPerformanceMetrics: () => PerformanceMetrics;
}

export interface CineViewRuntimeSnapshot {
  mode: ScrollMode;
  currentScene: number;
  totalScenes?: number;
  runtimeState?: RuntimeState;
}

/**
 * Scene 组件 Props
 */
export interface SceneProps {
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
    replayOnReenter?: boolean;
  };
  assets?: {
    preloadImages?: string[];
  };
  callbacks?: {
    onVisibilityChange?: (detail: SceneVisibilityDetail) => void;
  };
  children: ReactNode;
}

/**
 * Animate 组件 Props
 */
export interface AnimateProps {
  animateId?: string; // 组件唯一标识
  enterAnimation?: AnimationType; // 进入动画类型
  exitAnimation?: AnimationType; // 离开动画类型
  infiniteAnimation?: AnimationType; // 无限循环动画
  duration?: {
    enter?: number;
    exit?: number;
  };
  timeline?: {
    driver?: 'auto' | 'scene' | 'scroll' | 'visibility';
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
    enterWhen?: 'fully-visible-bottom';
    exitWhen?: 'leaving-top';
  };
  children: ReactNode;
}

export interface ScrollZoneProps {
  zoneId?: string;
  trigger?: 'center-lock';
  replayOnReenter?: boolean;
  budget?: 'auto' | number;
  children: ReactNode;
}

export interface ScrollTimelineState {
  phase: VirtualScrollPhase;
  enterProgress: number;
  holdProgress: number;
  exitProgress: number;
  sceneProgress: number;
  rangeStart: number;
  rangeEnd: number;
  rangeLength: number;
  enterLength: number;
  holdLength: number;
  exitLength: number;
}

/**
 * Position 组件 Props
 */
export interface PositionProps {
  at?: {
    x?: number;
    y?: number;
    offsetX?: number;
    offsetY?: number;
  };
  layer?: {
    fixed?: boolean;
  };
  children: ReactNode;
  positionId?: string; // 用于相对定位计算的标识
  style?: React.CSSProperties; // 额外的样式
  className?: string; // CSS 类名
}

/**
 * Container 组件 Props
 */
export interface ContainerProps {
  width?: number; // 容器宽度（设计稿单位）
  height?: number; // 容器高度（设计稿单位）
  children: ReactNode;
  style?: React.CSSProperties; // 额外的样式
  className?: string; // CSS 类名
}

// ============================================================================
// Data Model Types
// ============================================================================

/**
 * CineView 上下文
 */
export interface CineViewContext {
  designWidth?: number;
  designHeight?: number;
  designSize: number;
  unit: 'px' | 'rem' | 'vw';
  viewportWidth: number;
  viewportHeight: number;
  scaleX?: number;
  scaleY?: number;
  scale: number; // 换算比例
  convertX?: (size: number) => number;
  convertY?: (size: number) => number;
  convertSize: (size: number) => number; // 尺寸换算函数
  currentScene: number;
  totalScenes: number;
  goToScene: (index: number, animated?: boolean) => void;
}

/**
 * Scene 状态
 */
export interface SceneState {
  currentIndex: number; // 当前场景索引
  totalScenes: number; // 总场景数
  isAnimating: boolean; // 是否正在动画中（snap 模式）
  isDragging: boolean; // 是否正在拖拽中（drag 模式）
  isScrolling: boolean; // 是否正在滚动过渡中（scroll 模式）
  dragProgress: number; // 拖拽进度 0-1（drag 模式）
  scrollProgress: number; // 滚动推进进度 0-1（scroll 模式）
  direction: 'forward' | 'backward'; // 切换方向
  mode: ScrollMode; // 当前场景的滚动模式
  animateRegistry: Set<string>; // 当前场景内注册的 Animate 组件 ID 集合
}

/**
 * 动画注册表项
 */
export interface AnimationRegistryItem {
  status: 'pending' | 'playing' | 'completed';
  startTime: number; // 实际开始时间（相对于场景激活）
  duration: number; // 动画时长
  executionTime: number; // 实际执行时间 = startTime + duration
  waitFor?: string; // 关联的组件 ID
}

/**
 * 动画注册表
 */
export interface AnimationRegistry {
  [animateId: string]: AnimationRegistryItem;
}

/**
 * 图片预加载状态
 */
export interface PreloadState {
  totalImages: number;
  loadedImages: number;
  progress: number; // 0-100
  firstSceneLoaded: boolean;
  allLoaded: boolean;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * 手势类型
 */
export type GestureType = 'swipe-up' | 'swipe-down' | 'swipe-left' | 'swipe-right' | 'none';

/**
 * 错误码
 */
export const ErrorCodes = {
  INVALID_SCENE_INDEX: 'INVALID_SCENE_INDEX',
  CIRCULAR_DEPENDENCY: 'CIRCULAR_DEPENDENCY',
  INVALID_ANIMATION: 'INVALID_ANIMATION',
  IMAGE_LOAD_FAILED: 'IMAGE_LOAD_FAILED',
  INVALID_COMPONENT_HIERARCHY: 'INVALID_COMPONENT_HIERARCHY',
} as const;

/**
 * CineView 错误类
 */
export class CineViewError extends Error {
  constructor(
    message: string,
    public code: keyof typeof ErrorCodes
  ) {
    super(message);
    this.name = 'CineViewError';
  }
}

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_SLIDE_DURATION = 800; // 默认滑动动画时间（毫秒）
export const DEFAULT_ANIMATION_DURATION = 600; // 默认动画时长（毫秒）
export const THROTTLE_INTERVAL = 16; // 节流间隔（毫秒，60fps）
export const DEBOUNCE_DELAY = 150; // 防抖延迟（毫秒）
export const TARGET_FPS = 60; // 目标帧率
export const MAX_FRAME_TIME = 16.67; // 最大帧时间（毫秒）
export const MAX_BUNDLE_SIZE = 50; // 最大 Bundle 大小（KB，gzipped）
