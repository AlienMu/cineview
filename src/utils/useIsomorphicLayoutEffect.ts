import { useEffect, useLayoutEffect } from 'react';

/**
 * SSR 安全的 `useLayoutEffect`。
 *
 * 背景：`useLayoutEffect` 在服务端渲染时**不会执行**，React 因此发出
 * "useLayoutEffect does nothing on the server" 警告。对库来说这条警告会直接刷在
 * 消费者（Next.js / Remix 等）的服务端控制台里，而库本身完全没有布局要测。
 *
 * 修法是社区标准做法：无 DOM 时换成 `useEffect`。两者在服务端都不执行，
 * 所以**客户端行为零变化**，只是消掉了服务端那条无意义的警告。
 *
 * 判定用 `typeof document !== 'undefined'` 而不是 `window`：SSR 场景里
 * 二者都缺席，但 `document` 是 layout 测量真正依赖的对象，语义更贴切。
 *
 * 注意：这个常量在模块加载时求值一次。库的所有产物都在浏览器或服务端**其一**
 * 环境中运行整个生命周期，不存在中途获得 DOM 的情况，故无需每次渲染重判。
 */
export const useIsomorphicLayoutEffect =
  typeof document !== 'undefined' ? useLayoutEffect : useEffect;
