/**
 * 尺寸换算工具函数
 * 根据设计稿尺寸和视口宽度计算实际尺寸
 */

import type { SizeUnit } from '../types';

/**
 * 转换设计稿尺寸为实际尺寸
 * @param size - 设计稿中的尺寸值
 * @param designSize - 设计稿宽度
 * @param viewportWidth - 视口宽度
 * @param _unit - 单位类型（保留用于 API 兼容性）
 * @returns 转换后的实际尺寸
 * @example
 * convertSize(100, 750, 750, 'px') // 返回 100
 * convertSize(100, 750, 375, 'px') // 返回 50
 */
export function convertSize(
  size: number,
  designSize: number,
  viewportWidth: number,
  _unit: SizeUnit
): number {
  // 所有单位都根据视口宽度和设计稿宽度计算比例
  const scale = viewportWidth / designSize;
  return size * scale;
}

/**
 * 计算缩放比例
 * @param viewportWidth - 视口宽度
 * @param designSize - 设计稿宽度
 * @returns 缩放比例
 * @example
 * calculateScale(375, 750) // 返回 0.5
 */
export function calculateScale(viewportWidth: number, designSize: number): number {
  if (designSize <= 0) {
    throw new Error('Design size must be greater than 0');
  }
  return viewportWidth / designSize;
}

/**
 * 转换 px 为 rem
 * @param px - px 值
 * @param baseFontSize - 基础字体大小（默认 16px）
 * @returns rem 值
 */
export function pxToRem(px: number, baseFontSize: number = 16): number {
  return px / baseFontSize;
}

/**
 * 转换 px 为 vw
 * @param px - px 值
 * @param viewportWidth - 视口宽度
 * @returns vw 值
 */
export function pxToVw(px: number, viewportWidth: number): number {
  return (px / viewportWidth) * 100;
}

/**
 * 根据单位类型转换尺寸
 * @param size - 设计稿中的尺寸值
 * @param scale - 缩放比例
 * @param unit - 单位类型
 * @param viewportWidth - 视口宽度（用于 vw 转换）
 * @returns 转换后的尺寸字符串（带单位）
 */
export function convertSizeWithUnit(
  size: number,
  scale: number,
  unit: 'px' | 'rem' | 'vw',
  viewportWidth?: number
): string {
  const convertedSize = size * scale;

  switch (unit) {
    case 'px':
      return `${convertedSize}px`;
    case 'rem':
      return `${pxToRem(convertedSize)}rem`;
    case 'vw':
      if (!viewportWidth) {
        throw new Error('Viewport width is required for vw conversion');
      }
      return `${pxToVw(convertedSize, viewportWidth)}vw`;
    default:
      return `${convertedSize}px`;
  }
}
