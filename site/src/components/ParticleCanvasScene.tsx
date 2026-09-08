import { useEffect, useRef } from 'react';
import { Animate, useAnimateTimeline } from 'cineview';
import { useI18n } from '../i18n';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import {
  buildTypography,
  drawTypography,
  PARTICLE_DURATION_MS,
  type ParticleTypography,
} from './particleTypography';
import './ParticleCanvasScene.css';

function ParticleField({
  reduced,
  label,
}: {
  reduced: boolean;
  label: string;
}): import('react').JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { progress } = useAnimateTimeline();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    const mask = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (!context || !mask) return;

    const style = getComputedStyle(canvas);
    const fontFamily = style.getPropertyValue('--font-display').trim() || 'Georgia, serif';
    const ink = style.color;
    const accent = style.getPropertyValue('--particle-accent').trim() || '#ad8138';
    let width = 0;
    let height = 0;
    let dpr = 1;
    let visible = typeof IntersectionObserver === 'undefined';
    let fontDirty = true;
    let typography: ParticleTypography | undefined;
    let disposed = false;
    let drawCount = 0;

    const sizeBackingStore = (): void => {
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
    };

    const draw = (force = false): void => {
      if (disposed || !width || !height || (!force && (!visible || document.hidden))) return;
      // Some browsers defer resolution events. The next requested frame can
      // still update density without a layout read or an independent frame loop.
      const currentDpr = Math.min(window.devicePixelRatio || 1, 2);
      if (currentDpr !== dpr) {
        dpr = currentDpr;
        sizeBackingStore();
      }
      if (fontDirty || !typography) {
        typography = buildTypography(mask, width, height, fontFamily);
        fontDirty = false;
        canvas.dataset.particleCount = String(typography.points.length);
      }
      const value = reduced ? 1 : progress.get();
      drawTypography(context, typography, value, { dpr, ink, accent, reduced });
      canvas.dataset.canvasReady = 'true';
      canvas.dataset.progress = value.toFixed(4);
      canvas.dataset.drawCount = String(++drawCount);
    };

    const resize = (nextWidth: number, nextHeight: number): void => {
      const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
      if (nextWidth === width && nextHeight === height && nextDpr === dpr) return;
      fontDirty ||= nextWidth !== width || nextHeight !== height;
      width = nextWidth;
      height = nextHeight;
      dpr = nextDpr;
      sizeBackingStore();
      draw();
    };

    // Read layout only on mount and resize. Timeline updates use cached CSS dimensions.
    const measure = (): void => {
      const rect = canvas.getBoundingClientRect();
      resize(rect.width, rect.height);
    };
    measure();
    draw(true);
    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(([entry]) => {
            resize(entry.contentRect.width, entry.contentRect.height);
          });
    resizeObserver?.observe(canvas);
    const windowResize = (): void => {
      if (resizeObserver) resize(width, height);
      else measure();
    };
    window.addEventListener('resize', windowResize);

    // A display/zoom change can alter DPR without a CSS resize. Re-arm the query
    // after each change so subsequent transitions are observed as well.
    let removeDprListener = (): void => {};
    const watchDpr = (): void => {
      removeDprListener();
      if (typeof window.matchMedia !== 'function') return;
      const query = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      const changed = (): void => {
        resize(width, height);
        watchDpr();
      };
      if (typeof query.addEventListener === 'function') {
        query.addEventListener('change', changed);
        removeDprListener = (): void => query.removeEventListener('change', changed);
      } else {
        query.addListener(changed);
        removeDprListener = (): void => query.removeListener(changed);
      }
    };
    watchDpr();

    const intersectionObserver =
      typeof IntersectionObserver === 'undefined'
        ? undefined
        : new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting && entry.intersectionRatio > 0;
            canvas.dataset.visible = String(visible);
            if (visible) draw();
          });
    intersectionObserver?.observe(canvas);
    const unsubscribe = progress.on('change', () => {
      if (!reduced) draw();
    });
    const visibilityChange = (): void => {
      if (!document.hidden) draw();
    };
    document.addEventListener('visibilitychange', visibilityChange);

    const fontReady = (): void => {
      if (disposed) return;
      fontDirty = true;
      draw();
    };
    void document.fonts?.ready.then(fontReady);
    document.fonts?.addEventListener('loadingdone', fontReady);

    return (): void => {
      disposed = true;
      unsubscribe();
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      removeDprListener();
      window.removeEventListener('resize', windowResize);
      document.removeEventListener('visibilitychange', visibilityChange);
      document.fonts?.removeEventListener('loadingdone', fontReady);
    };
  }, [progress, reduced]);

  return (
    <div className="particle-stage__field">
      <canvas
        ref={canvasRef}
        className="particle-canvas"
        role="img"
        aria-label={label}
        data-motion={reduced ? 'static' : 'scroll'}
      >
        CINEVIEW
      </canvas>
      <span className="particle-stage__fallback" aria-hidden="true">
        CINEVIEW
      </span>
    </div>
  );
}

export function ParticleCanvasScene(): import('react').JSX.Element {
  const reduced = usePrefersReducedMotion();
  const { lang } = useI18n();
  const zh = lang === 'zh';
  return (
    <div className="particle-scene" data-lang={lang}>
      <header className="particle-scene__heading">
        <div className="cap-slate">SHOT 06 · CANVAS</div>
        <h2 className="cap-title particle-scene__title">
          {zh ? (
            <>滚动，让文字成形</>
          ) : (
            <>
              Scroll. Watch the type <em>take shape.</em>
            </>
          )}
        </h2>
        <p className="particle-scene__intro">
          {reduced
            ? zh
              ? '已按减少动态效果偏好显示静态文字。'
              : 'A still word, following your reduced motion preference.'
            : zh
              ? '向下滚动，像素聚成 CINEVIEW；向上滚动，回到分散的状态。'
              : 'Scroll down to assemble CINEVIEW. Scroll back to disperse the same pixels.'}
        </p>
      </header>
      <Animate
        animateId="canvas-field"
        enterAnimation={{ initial: { opacity: 1 }, animate: { opacity: 1 } }}
        duration={{ enter: reduced ? 0 : PARTICLE_DURATION_MS }}
      >
        <figure className="particle-stage">
          <div className="particle-stage__index" aria-hidden="true">
            <span>06 / CINEVIEW</span>
            <span>PIXEL STUDY</span>
          </div>
          <ParticleField
            reduced={reduced}
            label={
              reduced
                ? zh
                  ? 'CINEVIEW 静态文字。'
                  : 'CINEVIEW, static typography.'
                : zh
                  ? 'CINEVIEW 粒子文字。滚动可让像素聚合或分散。'
                  : 'CINEVIEW particle typography. Scroll to assemble or disperse the pixels.'
            }
          />
          <figcaption className="particle-stage__caption">
            <span>Canvas · useAnimateTimeline()</span>
            <span>{zh ? '同一进度，同一画面' : 'Same progress. Same image.'}</span>
          </figcaption>
        </figure>
      </Animate>
    </div>
  );
}
