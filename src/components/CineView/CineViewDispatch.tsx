import { forwardRef } from 'react';
import { CineViewDragEngine, resolveRootMode } from './CineView';
import { DirectScrollCineView } from './DirectScrollCineView';
import type { CineViewProps, CineViewRef } from '../../types';

/**
 * `mode` 派发器 —— 全量入口（ES / bundler 消费者）用的 `CineView`。
 *
 * 为什么单独成文件：它是**唯一同时静态引用两套引擎**的地方。原先它写在
 * `CineView.tsx` 尾部，导致任何到达那个文件的路径都会拖进两套引擎；UMD 必须单文件
 * （Rollup 拒绝 UMD 代码拆分），于是只用 drag 的消费者白背 scroll 引擎
 * gzip 10437 字节（全包 20.3%），把包顶破 50 KB 门。
 *
 * 隔离到本文件后：
 * - `src/index.ts`（ES 全量）→ 本文件 → 两套引擎，行为与拆分前**逐字节一致**。
 * - `src/entry-drag.ts` / `entry-scroll.ts`（UMD 单引擎）**绕过本文件**，
 *   各自只 import 自己那套引擎。
 * 详见 task-flow `2026-08-04-umd-mode-split.md`。
 */
const CineViewComponent = forwardRef<CineViewRef, CineViewProps>((props, ref) => {
  if (resolveRootMode(props.mode) === 'scroll') {
    return <DirectScrollCineView {...props} ref={ref} />;
  }
  return <CineViewDragEngine {...props} ref={ref} />;
});

CineViewComponent.displayName = 'CineView';

export const CineView = CineViewComponent;
