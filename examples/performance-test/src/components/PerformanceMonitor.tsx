import type { PerformanceMetrics } from 'cineview';
import type { ModeId } from '../routing';

interface PerformanceMonitorProps {
  currentScene: number;
  loadProgress: number;
  metrics: PerformanceMetrics | null;
  mode: ModeId;
  onToggle: () => void;
  open: boolean;
  totalScenes: number;
}

function metricTone(value: number, good: number, warning: number, reverse = false): string {
  if (reverse) {
    if (value <= good) return '#CBE7C8';
    if (value <= warning) return '#F0D295';
    return '#F0A48D';
  }

  if (value >= good) return '#CBE7C8';
  if (value >= warning) return '#F0D295';
  return '#F0A48D';
}

export default function PerformanceMonitor({
  currentScene,
  loadProgress,
  metrics,
  mode,
  onToggle,
  open,
  totalScenes,
}: PerformanceMonitorProps): import('react').JSX.Element {
  return (
    <div
      style={{
        position: 'fixed',
        top: 18,
        right: 18,
        zIndex: 12000,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <button
        aria-expanded={open}
        onClick={onToggle}
        style={{
          border: '1px solid rgba(100, 124, 170, 0.16)',
          borderRadius: 8,
          background: 'rgba(255,255,255,0.84)',
          color: '#273655',
          fontSize: 13,
          padding: '10px 14px',
          cursor: 'pointer',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 14px 30px rgba(139, 165, 209, 0.18)',
        }}
      >
        {open ? 'Hide metrics' : 'Metrics'}
      </button>

      {open && (
        <aside
          style={{
            width: 264,
            padding: 16,
            borderRadius: 8,
            background: 'rgba(255,255,255,0.9)',
            color: '#2A3858',
            border: '1px solid rgba(100, 124, 170, 0.16)',
            boxShadow: '0 18px 50px rgba(139, 165, 209, 0.2)',
            backdropFilter: 'blur(18px)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 12, color: '#7280A0' }}>Runtime</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{mode.toUpperCase()}</div>
            </div>
            <div style={{ fontSize: 12, color: '#7280A0' }}>
              {currentScene + 1}/{totalScenes}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            <MetricRow label="Load" value={`${loadProgress.toFixed(0)}%`} tone="#D9E3EE" />
            <MetricRow
              label="FPS"
              value={metrics ? metrics.fps.toFixed(1) : '--'}
              tone={metrics ? metricTone(metrics.fps, 55, 30) : '#D9E3EE'}
            />
            <MetricRow
              label="Frame"
              value={metrics ? `${metrics.avgFrameTime.toFixed(2)} ms` : '--'}
              tone={metrics ? metricTone(metrics.avgFrameTime, 16.67, 33.33, true) : '#D9E3EE'}
            />
            <MetricRow
              label="Memory"
              value={
                metrics?.memoryUsage !== undefined ? `${metrics.memoryUsage.toFixed(1)} MB` : '--'
              }
              tone={
                metrics?.memoryUsage !== undefined
                  ? metricTone(metrics.memoryUsage, 50, 100, true)
                  : '#D9E3EE'
              }
            />
            <MetricRow
              label="Bundle"
              value={metrics ? `${metrics.bundleSize.toFixed(1)} KB` : '--'}
              tone="#D9E3EE"
            />
          </div>

          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: '1px solid rgba(100, 124, 170, 0.16)',
              fontSize: 12,
              lineHeight: 1.55,
              color: '#6A7999',
            }}
          >
            Runtime data stays secondary so the product surface remains the primary read.
          </div>
        </aside>
      )}
    </div>
  );
}

function MetricRow({
  label,
  tone,
  value,
}: {
  label: string;
  tone: string;
  value: string;
}): import('react').JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 12px',
        borderRadius: 8,
        background: 'rgba(243, 247, 255, 0.9)',
      }}
    >
      <span style={{ fontSize: 12, color: '#7180A0' }}>{label}</span>
      <span style={{ fontSize: 13, color: tone, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}
