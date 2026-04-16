/**
 * OptimizedImage 组件
 * 提供图片优化功能：懒加载、WebP 支持、占位符、防止布局偏移
 */

import { useState, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';

export interface OptimizedImageProps {
  /** 图片 URL */
  src: string;
  /** 图片替代文本 */
  alt: string;
  /** 图片宽度 */
  width?: number | string;
  /** 图片高度 */
  height?: number | string;
  /** 宽高比 (例如: "16/9", "4/3") */
  aspectRatio?: string;
  /** 占位符颜色或图片 URL */
  placeholder?: string;
  /** 是否启用懒加载 */
  lazy?: boolean;
  /** 额外的 CSS 类名 */
  className?: string;
  /** 额外的样式 */
  style?: CSSProperties;
  /** 加载完成回调 */
  onLoad?: () => void;
  /** 加载失败回调 */
  onError?: (error: Error) => void;
}

/**
 * OptimizedImage 组件
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  aspectRatio,
  placeholder = '#f0f0f0',
  lazy = true,
  className = '',
  style = {},
  onLoad,
  onError,
}) => {
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isInView, setIsInView] = useState<boolean>(!lazy);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  /**
   * 使用 IntersectionObserver 优化加载时机
   */
  useEffect(() => {
    if (!lazy || isInView) return;

    const currentContainer = containerRef.current;
    if (!currentContainer) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observerRef.current?.disconnect();
          }
        });
      },
      {
        rootMargin: '50px', // 提前 50px 开始加载
        threshold: 0.01,
      }
    );

    observerRef.current.observe(currentContainer);

    return (): void => {
      observerRef.current?.disconnect();
    };
  }, [lazy, isInView]);

  /**
   * 处理图片加载完成
   */
  const handleLoad = (): void => {
    setIsLoaded(true);
    onLoad?.();
  };

  /**
   * 处理图片加载失败
   */
  const handleError = (): void => {
    setHasError(true);
    const error = new Error(`Failed to load image: ${src}`);
    onError?.(error);
  };

  /**
   * 计算容器样式
   */
  const containerStyle: CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: placeholder.startsWith('#') ? placeholder : 'transparent',
    ...(width && { width: typeof width === 'number' ? `${width}px` : width }),
    ...(height && { height: typeof height === 'number' ? `${height}px` : height }),
    ...(aspectRatio && { aspectRatio }),
    ...style,
  };

  /**
   * 计算图片样式
   */
  const imgStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'opacity 0.3s ease-in-out',
    opacity: isLoaded ? 1 : 0,
  };

  /**
   * 占位符样式
   */
  const placeholderStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: isLoaded ? 'none' : 'block',
    ...(placeholder.startsWith('http') && {
      backgroundImage: `url(${placeholder})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }),
  };

  return (
    <div
      ref={containerRef}
      className={`optimized-image-container ${className}`}
      style={containerStyle}
    >
      {/* 占位符 */}
      {!isLoaded && !hasError && <div style={placeholderStyle} aria-hidden="true" />}

      {/* 图片 */}
      {isInView && !hasError && (
        <img
          src={src}
          alt={alt}
          style={imgStyle}
          loading={lazy ? 'lazy' : 'eager'}
          onLoad={handleLoad}
          onError={handleError}
          {...(width && { width })}
          {...(height && { height })}
        />
      )}

      {/* 错误状态 */}
      {hasError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            backgroundColor: '#f5f5f5',
            color: '#999',
            fontSize: '14px',
          }}
        >
          Failed to load image
        </div>
      )}
    </div>
  );
};

OptimizedImage.displayName = 'OptimizedImage';
