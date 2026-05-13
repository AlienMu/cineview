import React from 'react';
import type { PerformanceMetrics } from 'cineview';

interface PerformanceMonitorProps {
  metrics: PerformanceMetrics;
  currentScene: number;
  totalScenes: number;
  loadProgress: number;
  mode: 'snap' | 'drag' | 'scroll';
  transitionDuration: number;
}

const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  metrics,
  currentScene,
  totalScenes,
  loadProgress,
  mode,
  transitionDuration,
}) => {
  const getFpsClass = (fps: number): string => {
    if (fps >= 55) return '';
    if (fps >= 30) return 'warning';
    return 'error';
  };

  const getFrameTimeClass = (frameTime: number): string => {
    if (frameTime <= 16.67) return '';
    if (frameTime <= 33.33) return 'warning';
    return 'error';
  };

  const getMemoryClass = (memory: number | undefined): string => {
    if (!memory) return '';
    if (memory < 50) return '';
    if (memory < 100) return 'warning';
    return 'error';
  };

  return (
    <div className="performance-monitor">
      <h3>⚡ Performance Monitor</h3>

      <div className="metric">
        <span className="metric-label">Scene:</span>
        <span className="metric-value">
          {currentScene + 1} / {totalScenes}
        </span>
      </div>

      <div className="metric">
        <span className="metric-label">Mode:</span>
        <span className="metric-value">
          {mode === 'snap' ? 'Snap' : mode === 'drag' ? 'Drag' : 'Scroll'}
        </span>
      </div>

      <div className="metric">
        <span className="metric-label">Load Progress:</span>
        <span className="metric-value">{loadProgress.toFixed(0)}%</span>
      </div>

      <div className="metric">
        <span className="metric-label">FPS:</span>
        <span className={`metric-value ${getFpsClass(metrics.fps)}`}>{metrics.fps.toFixed(1)}</span>
      </div>

      <div className="metric">
        <span className="metric-label">Frame Time:</span>
        <span className={`metric-value ${getFrameTimeClass(metrics.avgFrameTime)}`}>
          {metrics.avgFrameTime.toFixed(2)}ms
        </span>
      </div>

      {metrics.memoryUsage !== undefined && (
        <div className="metric">
          <span className="metric-label">Memory:</span>
          <span className={`metric-value ${getMemoryClass(metrics.memoryUsage)}`}>
            {metrics.memoryUsage.toFixed(1)}MB
          </span>
        </div>
      )}

      <div className="metric">
        <span className="metric-label">Bundle Size:</span>
        <span className="metric-value">{metrics.bundleSize.toFixed(1)}KB</span>
      </div>

      <div className="metric">
        <span className="metric-label">Transition:</span>
        <span className="metric-value">{transitionDuration}ms</span>
      </div>

      <div style={{ marginTop: '10px', fontSize: '10px', color: '#666' }}>
        <div>
          {mode === 'snap'
            ? 'Wheel / touch transitions'
            : mode === 'drag'
              ? 'Pan-driven drag transitions'
              : 'Virtual wheel / touch scroll transitions'}
        </div>
        <div>Target: 60 FPS (16.67ms)</div>
        <div>🟢 Good | 🟡 Warning | 🔴 Poor</div>
      </div>
    </div>
  );
};

export default PerformanceMonitor;
