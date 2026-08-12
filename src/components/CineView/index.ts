/**
 * CineView 组件导出
 */

// `CineView` 来自派发器（同时引用两套引擎），不是 `./CineView`（现在只含 drag 引擎）。
// 见 CineViewDispatch.tsx 的注释：这个隔离是 UMD 按 mode 拆产物的前提。
export { CineView } from './CineViewDispatch';
export type { CineViewPreloadTarget, CineViewProps, CineViewRef } from '../../types';
