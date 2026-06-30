/**
 * 样式换算（从 Image.tsx 抽出的公共逻辑）。px2vw 单尺子模型：所有数值型 CSS 长度
 * 都乘同一个 `scale`（设计 px → 物理 px），不再按轴向区分——横向 1px 与纵向 1px 是
 * 同一个单位，正方形永远是正方形。Image / VideoFrameRenderer 共用。
 *
 * 白名单仍保留：用于排除无量纲数值属性（`zIndex`/`opacity`/`flexGrow`/`fontWeight`/
 * `lineHeight` 等），它们是纯数字、不该被当作长度换算。
 */
import type { CSSProperties } from 'react';

/** 单尺子换算器（避免 util 反向依赖 context）。 */
export interface ScaleConverter {
  convert: (value: number) => number;
}

// px2vw 下所有长度键共用一个 scale，故合并为单一集合（原水平/垂直/标量三套）。
const lengthStyleKeys = new Set([
  // 尺寸
  'width',
  'minWidth',
  'maxWidth',
  'height',
  'minHeight',
  'maxHeight',
  // 定位
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
  // 外边距
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
  // 内边距
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
  // 边框
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
  // 间距 / 描边 / 字体
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
