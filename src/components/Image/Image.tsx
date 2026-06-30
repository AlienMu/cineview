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
  { src, alt, width, height, style, loading, preload = true, ...imgProps },
  ref
): JSX.Element {
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
  const resolvedLoading = loading ?? (preload ? 'eager' : 'lazy');

  // Warm the shared preload cache so this URL is registered with the framework's
  // preload pipeline (the same Set consulted by useImagePreloader). Without this
  // the `preload` prop only toggled the native loading attribute and an asset
  // rendered via <Image> stayed invisible to isImagePreloaded/subscribers.
  useEffect(() => {
    if (!preload || !src || typeof window === 'undefined') {
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
    return () => {
      loader.removeEventListener('load', handleLoad);
    };
  }, [preload, src]);

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
