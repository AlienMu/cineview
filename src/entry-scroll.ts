/**
 * `cineview/scroll` —— **只含滚动引擎**的入口。
 *
 * 存在理由同 `entry-drag.ts`：单文件 UMD 不能代码拆分，全量入口必然两套引擎
 * 都带。只用滚动的消费者不该背拖拽引擎的重量。
 *
 * 与拖拽入口的**不对称**（实测得出，不是遗漏）：这里**不需要**运行时强制
 * `mode`。`DirectScrollCineView` 内部把 `mode: 'scroll'` 硬编码在自己发出的
 * 事件 detail 里（DirectScrollCineView.tsx:188、469），**从不读 `props.mode`**，
 * 所以传错 `mode` 不会让它短路。拖拽引擎则相反（约 30 处 `!== 'drag'` 守卫），
 * 故只有那一侧需要覆写。多加一层无用包装只会白增体积。
 *
 * Props 类型不用 `Omit<CineViewProps, 'mode'>`，理由见 `entry-drag.ts` 文件头。
 */

import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import { DirectScrollCineView } from './components/CineView/DirectScrollCineView';
import type { CineViewBaseProps, ScrollModeCallbacks, CineViewRef } from './types';

export * from './public-api';

/** 滚动入口的 Props：无 `mode`，callbacks 固定为滚动组。 */
export type CineViewScrollProps = CineViewBaseProps & {
  callbacks?: ScrollModeCallbacks;
};

export const CineView = DirectScrollCineView as unknown as ForwardRefExoticComponent<
  CineViewScrollProps & RefAttributes<CineViewRef>
>;
