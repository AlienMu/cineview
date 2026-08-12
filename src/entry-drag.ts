/**
 * `cineview/drag` —— **只含拖拽引擎**的入口。
 *
 * 存在理由：单文件 UMD 无法代码拆分（Rollup 报
 * `UMD and IIFE output formats are not supported for code-splitting builds`），
 * 所以全量入口的 UMD 必然同时含拖拽 + 滚动两套引擎。实测滚动引擎
 * （`DirectScrollCineView`）单独占 UMD gzip 10437 字节 ≈ 全包 20%，
 * 只用拖拽的消费者不该背这份重量。
 *
 * 与全量入口的两点差异：
 * 1. 这里的 `CineView` 是拖拽引擎本身，不是按 `mode` 派发的组件。
 * 2. **`mode` 被运行时强制为 `'drag'`**，不是仅靠类型挡。原因：拖拽引擎内部约
 *    30 处 `if (resolvedRootMode !== 'drag') return;` 守卫读 `props.mode`，
 *    传 `mode="scroll"` 会渲染出壳但全部逻辑短路 —— 静默失效。而 UMD /
 *    script-tag 消费者没有类型保护，只有运行时覆写能真正堵住。
 *
 * Props 类型不用 `Omit<CineViewProps, 'mode'>`：`CineViewProps` 是以 `mode` 为
 * 判别式的联合（types/index.ts:377-379），Omit 掉判别式会把 `callbacks` 塌成
 * 两模式的并集、谁都不匹配。故直接从 `CineViewBaseProps` + 拖拽 callbacks 组装，
 * 天然无 `mode`，且保住 callbacks 与模式的对应关系。
 */

import { forwardRef, createElement } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import { CineViewDragEngine } from './components/CineView/CineView';
import type { CineViewBaseProps, DragModeCallbacks, CineViewRef } from './types';

export * from './public-api';

/** 拖拽入口的 Props：无 `mode`，callbacks 固定为拖拽组。 */
export type CineViewDragProps = CineViewBaseProps & {
  callbacks?: DragModeCallbacks;
};

const CineViewDragOnly = forwardRef<CineViewRef, CineViewDragProps>((props, ref) => {
  // script-tag / CJS 消费者没有类型保护，可能把 `mode="scroll"` 传进来。此时
  // **必须抛错**：本产物没有滚动引擎，静默按拖拽渲染会让人以为「滚动模式坏了」。
  // 抛错则直接指向正确产物。类型层已 Omit 掉 mode，故 TS 消费者走不到这里。
  const requested = (props as { mode?: string }).mode;
  if (requested !== undefined && requested !== 'drag') {
    throw new Error(
      `[CineView] 本产物（cineview.umd.js / "cineview/drag"）只含拖拽引擎，` +
        `不支持 mode="${requested}"。滚动模式请加载 cineview-scroll.umd.js（或 import "cineview/scroll"）；` +
        `需要运行时按 mode 切换请用全量入口 import "cineview"。`
    );
  }
  // mode 恒为 'drag'：拖拽引擎内部约 30 处以 `!== 'drag'` 守卫，缺省值必须坐实。
  return createElement(CineViewDragEngine, { ...props, mode: 'drag', ref });
});

CineViewDragOnly.displayName = 'CineViewDragOnly';

export const CineView = CineViewDragOnly as ForwardRefExoticComponent<
  CineViewDragProps & RefAttributes<CineViewRef>
>;
