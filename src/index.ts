/**
 * CineView React UI Framework
 * 专为 React 开发的 UI 框架，用于快速创建影院式全屏滑动页面介绍效果
 */

// Components
export { CineView } from './components/CineView';
export { Animate } from './components/Animate';
export { Position } from './components/Position';
export { Container } from './components/Container';
export { Scene } from './components/Scene';
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
  PresetAnimation,
  CustomAnimation,
  ComposedAnimation,
  AnimationType,
  CineViewConfig,
  CineViewProps,
  PerformanceMetrics,
  CineViewRef,
  AnimateProps,
  PositionProps,
  ContainerProps,
  SceneProps,
  CineViewContext,
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
