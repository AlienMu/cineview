/**
 * CineView React UI Framework
 * 专为 React 开发的 UI 框架，用于快速创建影院式全屏滑动页面介绍效果
 *
 * 本入口 = **全量**：`CineView` 是运行时按 `mode` 派发的组件，两套引擎都在包里。
 * 保持既有行为与导出面不变（默认 `mode='drag'`）。
 *
 * 若只用单一模式、且在意包体积，改用按模式的入口（UMD 消费者尤其相关，
 * 单文件 UMD 无法代码拆分，全量入口必然同时含两套引擎）：
 *   - `cineview/drag`   → 只含拖拽引擎
 *   - `cineview/scroll` → 只含滚动引擎
 * 见 `src/entry-drag.ts` / `src/entry-scroll.ts`。
 */

export * from './public-api';
export { CineView } from './components/CineView';
