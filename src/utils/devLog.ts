/**
 * 开发环境日志工具：仅在 `NODE_ENV === 'development'` 时输出，生产静默。
 *
 * 背景：animations 层历史上散落多处裸 `console.warn/error`（无 NODE_ENV 守卫）。
 * 虽然 build 时 `esbuild.drop:['console']` 会移除生产包里的 console 调用，但依赖
 * 本库源码的 dev 构建 / SSR 场景仍会打日志。此工具把门控集中一处，与 context /
 * Scene 等已有守卫模式对齐。
 *
 * 统一前缀 `[CineView]`，与其它面向开发者的诊断信息一致。
 */

const PREFIX = '[CineView]';

const onceKeys = new Set<string>();

export function devWarn(...args: unknown[]): void {
  if (process.env.NODE_ENV === 'development') {
    console.warn(PREFIX, ...args);
  }
}

export function devError(...args: unknown[]): void {
  if (process.env.NODE_ENV === 'development') {
    console.error(PREFIX, ...args);
  }
}

/** devWarn 的跨实例去重版：同 key 整个会话只告警一次，替代各模块手写的 once flag。 */
export function devWarnOnce(key: string, ...args: unknown[]): void {
  if (process.env.NODE_ENV !== 'development' || onceKeys.has(key)) return;
  onceKeys.add(key);
  console.warn(PREFIX, ...args);
}

/** devError 的跨实例去重版，语义同 devWarnOnce。 */
export function devErrorOnce(key: string, ...args: unknown[]): void {
  if (process.env.NODE_ENV !== 'development' || onceKeys.has(key)) return;
  onceKeys.add(key);
  console.error(PREFIX, ...args);
}
