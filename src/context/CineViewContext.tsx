/**
 * CineView Context
 * 提供全局响应式尺寸换算上下文。
 *
 * 换算模型：px2vw 单尺子（认宽不认高）。设计稿只有一个尺寸基准 `size`（设计 px），
 * 整张画布锁定 `scale = viewportWidth / size` 等比缩放——横向 1px 与纵向 1px 乘
 * 同一个 `scale`，正方形永远是正方形，圆永远是圆，绝不形变。高度方向超出的部分
 * 交给自然文档流 / 滚动延展（与 scroll 模式天然契合）。
 *
 * Context 只暴露换算内核 `{ scale, convert }`；Provider 根 DOM 同步输出长度型
 * `--cineview-unit: ${scale}px` 供外部 CSS 消费。不存在独立的高度基准。scroll takeover
 * 的时间预算独立按 `1ms = 1px` 结算，绝对场景跨度回退 DOM 实测；二者都不创建第二把
 * 设计尺子。故 provider 只接收 `designSize`，只跟踪 `viewportWidth`。
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { debounceCancelable } from '../utils/debounce';
import { devErrorOnce, devWarnOnce } from '../utils/devLog';

export interface CineViewContextValue {
  /** px2vw 单尺子比例：`viewportWidth / size`。仅 useAnimateScroll 的 gate margin 换算读它。 */
  scale: number;
  /** px2vw 单尺子换算：设计 px → 物理 px（`size * scale`）。所有长度量共用。 */
  convert: (size: number) => number;
}

const CineViewContext = createContext<CineViewContextValue | null>(null);

// Export the context for testing purposes
export { CineViewContext };

export interface CineViewProviderProps {
  /** 设计稿尺寸基准（设计 px）。全站唯一换算尺子：`scale = viewportWidth / designSize`。 */
  designSize?: number;
  children: React.ReactNode;
}

const FALLBACK_DESIGN_SIZE = 750;

// 一次性告警旗标（模块级）：无效 designSize 只在首次报错，避免每次渲染刷屏。
/**
 * designSize 守卫：`scale = viewportWidth / size` 的分母必须是有限正数，
 * 否则 scale 会变成 0 / Infinity / NaN 并污染全部换算。非法值回退 750，
 * 并在 development 下告警一次。
 */
function resolveDesignSize(designSize: number | undefined): number {
  if (designSize === undefined) return FALLBACK_DESIGN_SIZE;
  if (Number.isFinite(designSize) && designSize > 0) return designSize;
  devErrorOnce(
    'cineview-context:invalid-design-size',
    `Invalid designSize (${String(designSize)}). ` +
      `It must be a finite number > 0; falling back to ${FALLBACK_DESIGN_SIZE}.`
  );
  return FALLBACK_DESIGN_SIZE;
}

export const CineViewProvider: React.FC<CineViewProviderProps> = ({ designSize, children }) => {
  const resolvedDesignSize = resolveDesignSize(designSize);
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 750
  );

  // px2vw 单尺子：只认宽度。不存在独立高度基准。
  const scale = useMemo(
    () => viewportWidth / resolvedDesignSize,
    [viewportWidth, resolvedDesignSize]
  );
  const convert = useCallback(
    (size: number): number => {
      return size * scale;
    },
    [scale]
  );

  // 处理窗口 resize 事件：只跟踪宽度（换算唯一输入）。
  // 用可取消的 debounce：卸载时 cancel() 清掉在途定时器，
  // 避免 unmount 后 150ms 内仍触发 setState。
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const { debounced: handleResize, cancel } = debounceCancelable(() => {
      setViewportWidth(window.innerWidth);
    }, 150);

    window.addEventListener('resize', handleResize);

    return (): void => {
      window.removeEventListener('resize', handleResize);
      cancel();
    };
  }, []);

  const contextValue = useMemo<CineViewContextValue>(
    () => ({
      scale,
      convert,
    }),
    [scale, convert]
  );
  const responsiveStyle = useMemo(
    () =>
      ({
        '--cineview-unit': `${scale}px`,
      }) as React.CSSProperties,
    [scale]
  );

  return (
    <CineViewContext.Provider value={contextValue}>
      <div className="cineview-responsive-container" style={responsiveStyle}>
        {children}
      </div>
    </CineViewContext.Provider>
  );
};

/**
 * 使用 CineView 上下文
 */
export const useCineViewContext = (): CineViewContextValue | null => {
  const context = useContext(CineViewContext);
  return context;
};

// Provider 外的兜底换算函数：模块级单例，保证跨渲染身份稳定——
// 消费方把它放进依赖数组 / memo 时不会因每次渲染换引用而失效。
const identityConvert = (size: number): number => size;

/**
 * 使用尺寸换算函数
 * 便捷 hook，用于在组件中直接获取 convert 函数（px2vw 单尺子）。
 * 不在 CineView 内部时返回稳定身份的 identity 函数（不做换算），dev 下告警一次。
 */
export const useConvertSize = (): ((size: number) => number) => {
  const context = useCineViewContext();

  if (!context) {
    devWarnOnce(
      'cineview-context:convert-outside-provider',
      'useConvertSize must be used within a <CineView> component. ' +
        'Returning identity function (no conversion).'
    );
    return identityConvert;
  }

  return context.convert;
};
