import { useEffect, useRef, useState } from 'react';
import { usePerfMonitor, type PerformanceSource } from 'cineview/dev';
import { useI18n } from '../i18n';
import './RuntimeControlScene.css';

interface RuntimeControlSceneProps {
  source?: PerformanceSource | null;
  onVisibilityChange?: (visible: boolean) => void;
}

/** Display the existing CineView sampler only while this scene is visible. */
export function RuntimeControlScene({
  source,
  onVisibilityChange,
}: RuntimeControlSceneProps): import('react').JSX.Element {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const { lang } = useI18n();
  const perf = usePerfMonitor(source, visible);
  const metrics = perf?.current;
  const hasFrames = metrics !== undefined && metrics.avgFrameTime > 0;
  const history = perf?.history.filter((sample) => sample.avgFrameTime > 0) ?? [];
  const zh = lang === 'zh';

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    let previous: boolean | undefined;
    const updateVisibility = (next: boolean): void => {
      if (next === previous) return;
      previous = next;
      setVisible(next);
      onVisibilityChange?.(next);
    };

    if (typeof IntersectionObserver === 'undefined') {
      updateVisibility(true);
      return () => onVisibilityChange?.(false);
    }

    const observer = new IntersectionObserver(([entry]) => {
      updateVisibility(entry.isIntersecting && entry.intersectionRatio > 0);
    });
    observer.observe(scene);
    return () => {
      observer.disconnect();
      onVisibilityChange?.(false);
    };
  }, [onVisibilityChange]);

  return (
    <div
      ref={sceneRef}
      className="capability-full runtime-control"
      data-lang={lang}
      data-performance-visible={visible}
    >
      <div className="cap-slate">SHOT 07 · PERFORMANCE</div>
      <div className="runtime-content">
        <h2 className="cap-title runtime-title">
          {zh ? '查看当前页面的运行表现' : 'See how this page performs'}
        </h2>
        <div className="runtime-readout">
          <figure className="runtime-chart">
            <figcaption>{zh ? 'FPS 历史' : 'FPS history'}</figcaption>
            <svg
              viewBox="0 0 600 180"
              role="img"
              aria-label={
                zh ? 'FPS 历史，每 500 毫秒更新' : 'FPS history, updated every 500 milliseconds'
              }
              preserveAspectRatio="none"
            >
              {[0, 30, 60].map((value) => (
                <g key={value}>
                  <line x1="28" x2="596" y1={170 - value * 2.6} y2={170 - value * 2.6} />
                  <text x="0" y={174 - value * 2.6}>
                    {value}
                  </text>
                </g>
              ))}
              <polyline
                points={history
                  .map(
                    (sample, index) =>
                      `${28 + (index / 59) * 568},${170 - Math.max(0, Math.min(60, sample.fps)) * 2.6}`
                  )
                  .join(' ')}
              />
            </svg>
            <p className="runtime-caption">
              {zh
                ? '每 500 毫秒更新 · 最多保留 60 次采样'
                : 'Updated every 500 ms · Up to 60 samples'}
            </p>
          </figure>

          <dl className="runtime-metrics">
            <div>
              <dt>FPS</dt>
              <dd>{hasFrames ? metrics.fps.toFixed(1) : '--'}</dd>
            </div>
            <div>
              <dt>{zh ? '平均帧时' : 'Average frame'}</dt>
              <dd>{hasFrames ? `${metrics.avgFrameTime.toFixed(1)} ms` : '--'}</dd>
            </div>
            <div>
              <dt>{zh ? '页面代码估算' : 'Loaded code estimate'}</dt>
              <dd>
                {metrics && metrics.bundleSize > 0 ? `~${metrics.bundleSize.toFixed(1)} KB` : '--'}
              </dd>
            </div>
            <div>
              <dt>{zh ? 'JS 堆内存' : 'JS heap'}</dt>
              <dd>
                {metrics?.memoryUsage === undefined ? '--' : `${metrics.memoryUsage.toFixed(1)} MB`}
              </dd>
            </div>
          </dl>
        </div>
        <p className="runtime-note">
          {zh
            ? '代码大小根据浏览器已记录的 JavaScript 和 CSS 资源估算。内存数据仅在浏览器支持时显示。'
            : 'Code size estimates JavaScript and CSS resources recorded by the browser. Memory appears when the browser provides it.'}
        </p>
      </div>
    </div>
  );
}
