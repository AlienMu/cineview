import { forwardRef, useEffect, useMemo } from 'react';
import type { CSSProperties, ImgHTMLAttributes } from 'react';
import { useCineViewContext } from '../../context/CineViewContext';
import { isImagePreloaded, markImageAsPreloaded } from '../../hooks/imagePreloadCache';

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

const horizontalLengthStyleKeys = new Set([
  'width',
  'minWidth',
  'maxWidth',
  'left',
  'right',
  'marginLeft',
  'marginRight',
  'paddingLeft',
  'paddingRight',
  'borderLeftWidth',
  'borderRightWidth',
  'outlineOffset',
  'columnGap',
  'insetInline',
  'insetInlineStart',
  'insetInlineEnd',
  'marginInline',
  'marginInlineStart',
  'marginInlineEnd',
  'paddingInline',
  'paddingInlineStart',
  'paddingInlineEnd',
]);

const verticalLengthStyleKeys = new Set([
  'height',
  'minHeight',
  'maxHeight',
  'top',
  'bottom',
  'marginTop',
  'marginBottom',
  'paddingTop',
  'paddingBottom',
  'borderTopWidth',
  'borderBottomWidth',
  'rowGap',
  'insetBlock',
  'insetBlockStart',
  'insetBlockEnd',
  'marginBlock',
  'marginBlockStart',
  'marginBlockEnd',
  'paddingBlock',
  'paddingBlockStart',
  'paddingBlockEnd',
]);

const scalarLengthStyleKeys = new Set([
  'borderWidth',
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomRightRadius',
  'borderBottomLeftRadius',
  'fontSize',
  'gap',
  'inset',
  'letterSpacing',
  'margin',
  'outlineWidth',
  'padding',
]);

const convertNumericStyleValue = (
  key: string,
  value: unknown,
  context: ReturnType<typeof useCineViewContext>
): unknown => {
  if (!context || typeof value !== 'number' || !Number.isFinite(value) || key.startsWith('--')) {
    return value;
  }

  if (horizontalLengthStyleKeys.has(key)) {
    return context.convertX(value);
  }

  if (verticalLengthStyleKeys.has(key)) {
    return context.convertY(value);
  }

  if (scalarLengthStyleKeys.has(key)) {
    // Scalar lengths (borderRadius/fontSize/...) scale on the width axis;
    // convertX(s) === s * scaleX is identical to the old convertSize(s).
    return context.convertX(value);
  }

  return value;
};

const convertStyle = (
  style: CSSProperties | undefined,
  context: ReturnType<typeof useCineViewContext>
): CSSProperties | undefined => {
  if (!style || !context) {
    return style;
  }

  let changed = false;
  const convertedStyle: Record<string, unknown> = {};

  Object.entries(style as Record<string, unknown>).forEach(([key, value]) => {
    const convertedValue = convertNumericStyleValue(key, value, context);
    convertedStyle[key] = convertedValue;
    changed ||= convertedValue !== value;
  });

  return changed ? (convertedStyle as CSSProperties) : style;
};

export const Image = forwardRef<HTMLImageElement, ImageProps>(function Image(
  { src, alt, width, height, style, loading, preload = true, ...imgProps },
  ref
): JSX.Element {
  const cineViewContext = useCineViewContext();

  const resolvedWidth = useMemo(() => {
    if (typeof width !== 'number') {
      return width;
    }

    return cineViewContext?.convertX(width) ?? width;
  }, [cineViewContext, width]);

  const resolvedHeight = useMemo(() => {
    if (typeof height !== 'number') {
      return height;
    }

    return cineViewContext?.convertY(height) ?? height;
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
