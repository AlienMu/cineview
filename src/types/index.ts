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
export type ScrollMode = 'snap' | 'drag';

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
 * CineView 组件配置
 */
export interface CineViewConfig {
  designSize: number; // 设计稿宽度
  unit: 'px' | 'rem' | 'vw'; // 单位类型
}

/**
 * CineView 组件 Props
 */
export interface CineViewProps {
  config: CineViewConfig;
  children: ReactNode;
  onInit?: () => void;
  onBeforeSceneChange?: (fromIndex: number, toIndex: number) => void;
  onAfterSceneChange?: (currentIndex: number) => void;
  onLoadProgress?: (progress: number) => void; // 0-100
  performanceMode?: boolean; // 性能模式
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
  goToScene: (index: number, animated?: boolean) => void;
  triggerAnimation: (sceneIndex: number, animateId?: string) => void;
  reload: () => void;
  getCurrentScene: () => number;
  getPerformanceMetrics: () => PerformanceMetrics;
}

/**
 * Scene 组件 Props
 */
export interface SceneProps {
  slideDirection?: 'x' | 'y'; // 滑动方向
  slideMode?: 'snap' | 'drag'; // 滚动模式
  slideDuration?: number; // 滑动动画时间（毫秒）
  enterAnimation?: AnimationType; // 场景进入动画
  exitAnimation?: AnimationType; // 场景离开动画
  exitDuration?: number; // 离开动画时间（毫秒）
  children: ReactNode;
  preloadImages?: string[]; // 需要预加载的图片 URL 列表
}

/**
 * Animate 组件 Props
 */
export interface AnimateProps {
  enterAnimation?: AnimationType; // 进入动画类型
  enterDuration?: number; // 进入动画时间（毫秒）
  exitAnimation?: AnimationType; // 离开动画类型
  exitDuration?: number; // 离开动画时间（毫秒）
  delay?: number; // 动画延迟（毫秒）
  waitFor?: string; // 关联延迟组件 ID
  infiniteAnimation?: AnimationType; // 无限循环动画
  animateId?: string; // 组件唯一标识
  children: ReactNode;
}

/**
 * Position 组件 Props
 */
export interface PositionProps {
  x?: number; // 绝对 X 坐标（设计稿单位）
  y?: number; // 绝对 Y 坐标（设计稿单位）
  offsetX?: number; // 相对 X 偏移（设计稿单位）
  offsetY?: number; // 相对 Y 偏移（设计稿单位）
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
  designSize: number;
  unit: 'px' | 'rem' | 'vw';
  viewportWidth: number;
  viewportHeight: number;
  scale: number; // 换算比例
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
  dragProgress: number; // 拖拽进度 0-1（drag 模式）
  direction: 'forward' | 'backward'; // 切换方向
  slideMode: 'snap' | 'drag'; // 当前场景的滚动模式
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
