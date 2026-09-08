/**
 * Development performance panel.
 *
 * Pass the ref received from `callbacks.onReady`. Sampling is shared by all
 * consumers and the panel remains a presentation layer. Import
 * `cineview/dev/style.css` separately in a browser entry point.
 */
import { useRef, useState } from 'react';
import './PerfPanel.css';
import { usePerfMonitor, type PerformanceSource } from './usePerfMonitor';

export interface PerfPanelProps {
  /** 面板位置 */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** 是否默认展开 */
  defaultExpanded?: boolean;
  /** Public CineView ref (usually captured from callbacks.onReady). */
  source?: PerformanceSource | null;
  /** Disable polling while the panel is hidden. */
  enabled?: boolean;
  /** Allow the panel to be moved away from content it covers. */
  draggable?: boolean;
  /** Display labels in the site's active language. */
  lang?: 'en' | 'zh';
}

const HISTORY_LENGTH = 60;
const WARNING_FRAME_TIME = 32;
const CRITICAL_FRAME_TIME = 50;

export function PerfPanel({
  position = 'top-right',
  defaultExpanded = true,
  source = null,
  enabled = true,
  draggable = true,
  lang = 'en',
}: PerfPanelProps): import('react').JSX.Element {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const panelRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    left: number;
    top: number;
  } | null>(null);
  const stats = usePerfMonitor(source, enabled);
  const metrics = stats?.current ?? null;
  const fps = metrics?.fps ?? 0;
  const frameTime = metrics?.avgFrameTime ?? 0;
  const fpsHistory =
    stats?.history.filter((sample) => sample.avgFrameTime > 0).map((sample) => sample.fps) ?? [];
  const hasWarning = metrics !== null && frameTime > WARNING_FRAME_TIME;
  const hasCritical = metrics !== null && frameTime > CRITICAL_FRAME_TIME;
  const fpsColor = fps >= 55 ? '#6ee7b7' : fps >= 45 ? '#fbbf24' : '#ef4444';
  const frameTimeColor = frameTime <= 20 ? '#6ee7b7' : frameTime <= 32 ? '#fbbf24' : '#ef4444';
  const copy =
    lang === 'zh'
      ? {
          expand: '展开 CineView 性能面板',
          collapse: '收起 CineView 性能面板',
          title: 'CineView 性能',
          fps: '帧率',
          frame: '平均帧时',
          loaded: '已加载代码',
          history: '帧率历史',
          memory: '内存',
          samples: '采样数',
          monitor: '监视器',
          waiting: '等待 CineView 引用',
          warning: '性能警告',
          issue: '性能问题',
          details: (value: string): string => `平均帧时：${value}（目标 <16.67ms）`,
          loadedTitle: '根据 Resource Timing 估算的页面 JavaScript 和 CSS，不是包 gzip 大小。',
        }
      : {
          expand: 'Expand CineView performance panel',
          collapse: 'Collapse CineView performance panel',
          title: 'CineView Performance',
          fps: 'FPS',
          frame: 'Avg Frame',
          loaded: 'Loaded code',
          history: 'FPS History',
          memory: 'Memory',
          samples: 'Samples',
          monitor: 'Monitor',
          waiting: 'Waiting for CineView ref',
          warning: 'Performance warning',
          issue: 'Performance issue',
          details: (value: string): string => `Average frame time: ${value} (target <16.67ms)`,
          loadedTitle:
            'Estimated loaded page JavaScript and CSS from Resource Timing; not package gzip size.',
        };

  const startDrag = (event: React.PointerEvent<HTMLElement>): void => {
    if (!draggable || event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.dataset.dragging = 'true';
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: React.PointerEvent<HTMLElement>): void => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || !panel || drag.pointerId !== event.pointerId) return;
    panel.style.left = `${Math.max(8, drag.left + event.clientX - drag.startX)}px`;
    panel.style.top = `${Math.max(8, drag.top + event.clientY - drag.startY)}px`;
  };

  const stopDrag = (event: React.PointerEvent<HTMLElement>): void => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    panelRef.current?.removeAttribute('data-dragging');
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  if (!expanded) {
    return (
      <button
        type="button"
        className={`cineview-perf-panel cineview-perf-panel--collapsed cineview-perf-panel--${position}`}
        onClick={() => setExpanded(true)}
        aria-label={copy.expand}
      >
        <span className="cineview-perf-collapsed-label">
          <span style={{ color: fpsColor }}>{metrics ? fps : '--'}</span> fps
        </span>
      </button>
    );
  }

  return (
    <section
      ref={panelRef}
      className={`cineview-perf-panel cineview-perf-panel--${position}`}
      aria-label={copy.title}
    >
      <div
        className="cineview-perf-header"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        data-draggable={draggable ? 'true' : 'false'}
      >
        <h3 className="cineview-perf-title">{copy.title}</h3>
        <button
          type="button"
          className="cineview-perf-toggle"
          onClick={() => setExpanded(false)}
          aria-label={copy.collapse}
        >
          −
        </button>
      </div>

      <div className="cineview-perf-body">
        <div className="cineview-perf-metrics">
          <div className="cineview-perf-metric">
            <div className="cineview-perf-metric-label">{copy.fps}</div>
            <div className="cineview-perf-metric-value" style={{ color: fpsColor }}>
              {metrics ? fps : '--'}
            </div>
          </div>
          <div className="cineview-perf-metric">
            <div className="cineview-perf-metric-label">{copy.frame}</div>
            <div className="cineview-perf-metric-value" style={{ color: frameTimeColor }}>
              {metrics ? `${frameTime.toFixed(1)}ms` : '--'}
            </div>
          </div>
          <div className="cineview-perf-metric">
            <div className="cineview-perf-metric-label" title={copy.loadedTitle}>
              {copy.loaded}
            </div>
            <div className="cineview-perf-metric-value">
              {metrics ? `~${metrics.bundleSize.toFixed(1)} KB` : '--'}
            </div>
          </div>
        </div>

        <div className="cineview-perf-chart">
          <div className="cineview-perf-chart-title">{copy.history}</div>
          <svg
            className="cineview-perf-chart-svg"
            viewBox="0 0 300 60"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <line
              x1="0"
              y1="30"
              x2="300"
              y2="30"
              stroke="#374151"
              strokeWidth="0.5"
              strokeDasharray="2,2"
            />
            <line
              x1="0"
              y1="50"
              x2="300"
              y2="50"
              stroke="#374151"
              strokeWidth="0.5"
              strokeDasharray="2,2"
            />
            <polyline
              points={fpsHistory
                .map(
                  (value, index) =>
                    `${(index / Math.max(HISTORY_LENGTH - 1, 1)) * 300},${60 - (value / 60) * 60}`
                )
                .join(' ')}
              fill="none"
              stroke={fpsColor}
              strokeWidth="2"
            />
          </svg>
          <div className="cineview-perf-chart-labels">
            <span>60</span>
            <span>30</span>
            <span>0</span>
          </div>
        </div>

        {metrics ? (
          <div className="cineview-perf-stats">
            <div className="cineview-perf-stat">
              <span className="cineview-perf-stat-label">{copy.memory}</span>
              <span className="cineview-perf-stat-value">
                {metrics.memoryUsage === undefined ? 'n/a' : `${metrics.memoryUsage.toFixed(1)} MB`}
              </span>
            </div>
            <div className="cineview-perf-stat">
              <span className="cineview-perf-stat-label">{copy.samples}</span>
              <span className="cineview-perf-stat-value">{stats?.history.length ?? 0}</span>
            </div>
          </div>
        ) : (
          <div className="cineview-perf-stat">
            <span className="cineview-perf-stat-label">{copy.monitor}</span>
            <span className="cineview-perf-stat-value">{copy.waiting}</span>
          </div>
        )}

        {hasWarning && (
          <div
            className={`cineview-perf-warning ${hasCritical ? 'cineview-perf-warning--critical' : ''}`}
          >
            {hasCritical ? copy.issue : copy.warning}
            <div className="cineview-perf-warning-details">
              {copy.details(`${frameTime.toFixed(1)}ms`)}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
