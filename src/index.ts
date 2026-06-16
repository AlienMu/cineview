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
import type { AnimateProps, PositionProps, SceneProps } from './types';

// Components
export { CineView };
export const Animate = AnimateComponent as FC<AnimateProps>;
export const Position = PositionComponent as FC<PositionProps>;
export { Container };
export const Scene = SceneComponent as FC<SceneProps>;
export { Image } from './components/Image';
export type { ImageProps } from './components/Image';

// Types
export type {
  SizeUnit,
  SlideDirection,
  ScrollMode,
  CineViewDesignConfig,
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
  CineViewPreloadTarget,
  AnimateProps,
  PositionProps,
  ContainerProps,
  SceneProps,
} from './types';
