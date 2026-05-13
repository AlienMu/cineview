/**
 * CineView React UI Framework
 * 专为 React 开发的 UI 框架，用于快速创建影院式全屏滑动页面介绍效果
 */

import type { FC } from 'react';
import { Animate as AnimateComponent } from './components/Animate';
import { CineView } from './components/CineView';
import { Container } from './components/Container';
import { Position as PositionComponent } from './components/Position';
import { Scene as SceneComponent } from './components/Scene';
import { ScrollZone } from './components/ScrollZone';
import type { AnimateProps, PositionProps, SceneProps } from './types';

// Components
export { CineView };
export const Animate = AnimateComponent as FC<AnimateProps>;
export const Position = PositionComponent as FC<PositionProps>;
export { Container };
export const Scene = SceneComponent as FC<SceneProps>;
export { ScrollZone };
export { Preloader } from './components/Preloader';
export { OptimizedImage } from './components/Preloader';
export type { PreloaderProps, OptimizedImageProps } from './components/Preloader';

// Hooks
export { useResponsive } from './hooks/useResponsive';
export { useSceneManager } from './hooks/useSceneManager';
export { useImagePreloader } from './hooks/useImagePreloader';
export { useConvertSize } from './context/CineViewContext';

// Types
export type {
  SizeUnit,
  SlideDirection,
  ScrollMode,
  RuntimeState,
  CineViewDesignConfig,
  SnapModeConfig,
  DragThresholdConfig,
  DragModeConfig,
  ScrollModeConfig,
  ScrollbarConfig,
  SceneChangeDetail,
  InteractionStateDetail,
  LayoutMeasuredDetail,
  CineViewErrorDetail,
  DragDetail,
  DragCommitDetail,
  ZoneDetail,
  ZoneProgressDetail,
  SceneVisibilityDetail,
  CineViewCallbacks,
  CineViewPerformanceConfig,
  PresetAnimation,
  CustomAnimation,
  ComposedAnimation,
  AnimationType,
  CineViewProps,
  PerformanceMetrics,
  CineViewRef,
  CineViewRuntimeSnapshot,
  AnimateProps,
  ScrollZoneProps,
  PositionProps,
  ContainerProps,
  SceneProps,
  ScrollTimelineState,
  VirtualScrollPhase,
  SceneState,
  PreloadState,
  GestureType,
  ParsedAnimationVariant,
} from './types';

export { ErrorCodes, CineViewError } from './types';

// Constants
export {
  DEFAULT_SLIDE_DURATION,
  DEFAULT_ANIMATION_DURATION,
  THROTTLE_INTERVAL,
  DEBOUNCE_DELAY,
  TARGET_FPS,
  MAX_FRAME_TIME,
  MAX_BUNDLE_SIZE,
} from './types';
