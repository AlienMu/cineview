/**
 * 开发者工具导出
 *
 * 包含：
 * - PerfPanel: 实时性能监控面板
 *
 * 使用：
 * import { PerfPanel } from 'cineview/dev';
 * import 'cineview/dev/style.css';
 */

export { PerfPanel } from './PerfPanel';
export type { PerfPanelProps } from './PerfPanel';
export { usePerfMonitor } from './usePerfMonitor';
export type { PerfStats, PerformanceSource } from './usePerfMonitor';
