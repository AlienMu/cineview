/**
 * CineView React UI Framework
 * 专为 React 开发的 UI 框架，用于快速创建影院式全屏滑动页面介绍效果
 */

import type { FC, ForwardRefExoticComponent, RefAttributes } from 'react';
import { Animate as AnimateComponent } from './components/Animate';
export { useAnimateTimeline } from './components/Animate';
import { CineView } from './components/CineView';
import { Container } from './components/Container';
import { Position as PositionComponent } from './components/Position';
import { Scene as SceneComponent } from './components/Scene';
import type { AnimateProps, PositionProps, SceneProps } from './types';

// Components
export { CineView };
export const Animate = AnimateComponent as FC<AnimateProps>;
// Position/Scene 的真实实现是 forwardRef（可拿到根 <div> 的 ref）；公共类型必须
// 保留 ref 能力，故 cast 为 ForwardRefExoticComponent 而非 FC（FC 会抹掉 ref prop）。
export const Position = PositionComponent as ForwardRefExoticComponent<
  PositionProps & RefAttributes<HTMLDivElement>
>;
export { Container };
export const Scene = SceneComponent as ForwardRefExoticComponent<
  SceneProps & RefAttributes<HTMLDivElement>
>;
export { Image } from './components/Image';
export type { ImageProps } from './components/Image';
export { AnimateVideo } from './components/Animate/AnimateVideo';
export type { AnimateVideoProps } from './components/Animate/AnimateVideo';

// Types
export type {
  SlideDirection,
  ScrollMode,
  SceneAnchor,
  SceneStackMode,
  CineViewDesignConfig,
  DragThresholdConfig,
  DragTimelineUnit,
  SceneDragConfig,
  DragModeConfig,
  ScrollModeConfig,
  ScrollbarConfig,
  SceneChangeDetail,
  CineViewErrorCode,
  CineViewErrorDetail,
  DragDetail,
  DragStartDetail,
  DragBlockedDetail,
  DragCommitDetail,
  ZoneDetail,
  ZoneProgressDetail,
  SceneVisibilityDetail,
  CineViewCommonCallbacks,
  CineViewDragCallbacks,
  CineViewScrollCallbacks,
  DragModeCallbacks,
  ScrollModeCallbacks,
  CineViewCallbacks,
  CineViewPerformanceConfig,
  PresetAnimation,
  CustomAnimation,
  ComposedAnimation,
  AnimationType,
  CineViewProps,
  PerformanceMetrics,
  CineViewRef,
  CineViewScrollRef,
  CineViewPreloadTarget,
  AnimateProps,
  AnimateStaggerConfig,
  AnimateRenderState,
  AnimatePhase,
  AnimateTimelineDriver,
  AnimateTimelineSource,
  AnimateTimelineFrame,
  AnimateTimeline,
  PositionProps,
  ContainerProps,
  SceneProps,
} from './types';
