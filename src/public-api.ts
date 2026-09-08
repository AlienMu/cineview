/**
 * Mode-agnostic portion of the public export surface.
 *
 * Why a separate file: Three entry points (index.ts full dispatch / entry-drag.ts / entry-scroll.ts)
 * need to export the same set of Animate/Position/Container/Scene/Image/AnimateVideo + all types.
 * The only difference is which engine CineView points to. If mode entries used `export * from './index'`,
 * they would pull in the dispatcher statically imported by index.ts (along with both engines) — in practice,
 * the UMD bundle grew from 51391 to 51937 bytes. So we place the mode-agnostic surface here, and each
 * entry only adds its own CineView.
 *
 * ⚠️ This file MUST NOT export any of CineView / CineViewDragEngine / DirectScrollCineView,
 * otherwise mode entries would pull in both engines simultaneously, defeating the split.
 */

import type { ForwardRefExoticComponent, ReactNode, RefAttributes } from 'react';
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

export const Animate: (props: AnimateProps) => ReactNode = AnimateComponent;
// Position/Scene are implemented with forwardRef (exposing the root <div> ref). Public types must
// preserve ref capability, so cast to ForwardRefExoticComponent rather than FC (FC erases ref prop).
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
