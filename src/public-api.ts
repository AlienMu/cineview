/**
 * 公共导出面中**与模式无关**的那部分。
 *
 * 为什么单独一个文件：三个入口（`index.ts` 全量派发 / `entry-drag.ts` / `entry-scroll.ts`）
 * 需要导出同一套 Animate/Position/Container/Scene/Image/AnimateVideo + 全部类型，
 * 唯一差别是 `CineView` 指向哪个引擎。若让 mode 入口 `export * from './index'`，
 * 就会把 `index.ts` 静态 import 的派发器（连带两个引擎）拖进来——实测 UMD 反而从
 * 51391 涨到 51937 字节。故把「模式无关的面」放这里，三个入口各自只补自己的 CineView。
 *
 * ⚠️ 本文件**不得**导出 CineView / CineViewDragEngine / DirectScrollCineView 中的任何一个，
 * 否则 mode 入口又会同时拖进两个引擎，拆分失效。
 */

import type { FC, ForwardRefExoticComponent, RefAttributes } from 'react';
import { Animate as AnimateComponent } from './components/Animate';
import { Position as PositionComponent } from './components/Position';
import { Scene as SceneComponent } from './components/Scene';
import type { AnimateProps, PositionProps, SceneProps } from './types';

export { useAnimateTimeline } from './components/Animate';
export { Container } from './components/Container';
export { Image } from './components/Image';
export type { ImageProps } from './components/Image';
export { AnimateVideo } from './components/Animate/AnimateVideo';
export type { AnimateVideoProps } from './components/Animate/AnimateVideo';

export const Animate = AnimateComponent as FC<AnimateProps>;
// Position/Scene 的真实实现是 forwardRef（可拿到根 <div> 的 ref）；公共类型必须
// 保留 ref 能力，故 cast 为 ForwardRefExoticComponent 而非 FC（FC 会抹掉 ref prop）。
export const Position = PositionComponent as ForwardRefExoticComponent<
  PositionProps & RefAttributes<HTMLDivElement>
>;
export const Scene = SceneComponent as ForwardRefExoticComponent<
  SceneProps & RefAttributes<HTMLDivElement>
>;

// Types
export type {
  SlideDirection,
  ScrollMode,
  SceneAnchor,
  SceneStackMode,
  DragThresholdConfig,
  DragTimelineUnit,
  SceneDragConfig,
  DragModeConfig,
  ScrollModeConfig,
  ScrollbarConfig,
  A11yConfig,
  SceneChangeDetail,
  CineViewErrorCode,
  CineViewErrorDetail,
  DragDetail,
  DragStartDetail,
  DragBlockedDetail,
  DragEndDetail,
  ZoneDetail,
  ZoneProgressDetail,
  SceneVisibilityDetail,
  CineViewCommonCallbacks,
  CineViewDragCallbacks,
  CineViewScrollCallbacks,
  DragModeCallbacks,
  ScrollModeCallbacks,
  CineViewCallbacks,
  PresetAnimation,
  CustomAnimation,
  ComposedAnimation,
  AnimationType,
  CineViewBaseProps,
  CineViewDragModeProps,
  CineViewScrollModeProps,
  CineViewProps,
  PerformanceMetrics,
  CineViewRef,
  CineViewScrollRef,
  CineViewPreloadTarget,
  AnimateProps,
  AnimateStaggerConfig,
  AnimateRenderState,
  AnimatePhase,
  AnimateTimelineLane,
  AnimateTimelineSource,
  AnimateTimelineFrame,
  AnimateTimeline,
  PositionProps,
  ContainerProps,
  SceneProps,
} from './types';
