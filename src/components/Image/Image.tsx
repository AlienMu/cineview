import { forwardRef, useEffect, useMemo } from 'react';
import type { CSSProperties, ImgHTMLAttributes } from 'react';
import { useCineViewContext } from '../../context/CineViewContext';
import { isImagePreloaded, markImageAsPreloaded } from '../../hooks/imagePreloadCache';
import { convertStyle } from '../../utils/styleConvert';

type NativeImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'alt' | 'width' | 'height' | 'style'
>;

export interface ImageProps extends NativeImageProps {
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  style?: CSSProperties;
  preload?: boolean;
}

export const Image = forwardRef<HTMLImageElement, ImageProps>(function Image(
  { src, alt, width, height, style, loading, preload, ...imgProps },
  ref
): React.JSX.Element {
  const cineViewContext = useCineViewContext();

  const resolvedWidth = useMemo(() => {
    if (typeof width !== 'number') {
      return width;
    }

    return cineViewContext?.convert(width) ?? width;
  }, [cineViewContext, width]);

  const resolvedHeight = useMemo(() => {
    if (typeof height !== 'number') {
      return height;
    }

    return cineViewContext?.convert(height) ?? height;
  }, [cineViewContext, height]);

  const resolvedStyle = useMemo(
    () => convertStyle(style, cineViewContext),
    [cineViewContext, style]
  );
  const shouldPreload = loading === 'lazy' ? false : (preload ?? true);
  const resolvedLoading = loading ?? (shouldPreload ? 'eager' : 'lazy');

  // Warm the shared preload cache so this URL is registered with the framework's
  // preload pipeline (the same Set consulted by useImagePreloader). Without this
  // the `preload` prop only toggled the native loading attribute and an asset
  // rendered via <Image> stayed invisible to isImagePreloaded/subscribers.
  useEffect(() => {
    if (!shouldPreload || !src || typeof window === 'undefined') {
      return;
    }
    if (isImagePreloaded(src)) {
      return;
    }
    const loader = new window.Image();
    const handleLoad = (): void => {
      markImageAsPreloaded(src);
    };
    loader.addEventListener('load', handleLoad);
    loader.src = src;
    return (): void => {
      loader.removeEventListener('load', handleLoad);
    };
  }, [shouldPreload, src]);

  return (
    <img
      ref={ref}
      {...imgProps}
      src={src}
      alt={alt}
      width={resolvedWidth}
      height={resolvedHeight}
      style={resolvedStyle}
      loading={resolvedLoading}
    />
  );
});

Image.displayName = 'Image';
