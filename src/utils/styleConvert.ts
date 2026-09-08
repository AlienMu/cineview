/**
 * Style conversion utilities extracted from Image.tsx. Single-ruler model: all numeric CSS lengths
 * are multiplied by the same `scale` factor (design px → physical px), with no axis-specific
 * distinction—1px horizontal equals 1px vertical, preserving aspect ratios. Shared by Image and
 * VideoFrameRenderer.
 *
 * Whitelist retained to exclude unitless numeric properties (`zIndex`/`opacity`/`flexGrow`/
 * `fontWeight`/`lineHeight`, etc.) that should not be treated as length values.
 */
import type { CSSProperties } from 'react';

/** Single-ruler converter interface (avoids circular dependency on context). */
export interface ScaleConverter {
  convert: (value: number) => number;
}

// All length keys share a single scale under px2vw, so merged into one set (formerly separate horizontal/vertical/scalar sets).
const lengthStyleKeys = new Set([
  // Dimensions
  'width',
  'minWidth',
  'maxWidth',
  'height',
  'minHeight',
  'maxHeight',
  // Positioning
  'top',
  'bottom',
  'left',
  'right',
  'inset',
  'insetInline',
  'insetInlineStart',
  'insetInlineEnd',
  'insetBlock',
  'insetBlockStart',
  'insetBlockEnd',
  // Margin
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginInline',
  'marginInlineStart',
  'marginInlineEnd',
  'marginBlock',
  'marginBlockStart',
  'marginBlockEnd',
  // Padding
  'padding',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingInline',
  'paddingInlineStart',
  'paddingInlineEnd',
  'paddingBlock',
  'paddingBlockStart',
  'paddingBlockEnd',
  // Border
  'borderWidth',
  'borderTopWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderRightWidth',
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomRightRadius',
  'borderBottomLeftRadius',
  // Spacing / Outline / Typography
  'gap',
  'columnGap',
  'rowGap',
  'fontSize',
  'letterSpacing',
  'outlineWidth',
  'outlineOffset',
]);

export const convertNumericStyleValue = (
  key: string,
  value: unknown,
  context: ScaleConverter | null
): unknown => {
  if (!context || typeof value !== 'number' || !Number.isFinite(value) || key.startsWith('--')) {
    return value;
  }

  if (lengthStyleKeys.has(key)) {
    return context.convert(value);
  }

  return value;
};

export const convertStyle = (
  style: CSSProperties | undefined,
  context: ScaleConverter | null
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
