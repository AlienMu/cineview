import { useEffect, useRef } from 'react';
import { Animate, useAnimateTimeline } from 'cineview';
import { useI18n } from '../i18n';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import {
  buildCanvasTargets,
  CANVAS_COPY,
  CANVAS_ZONE_MS,
  drawCanvasTargets,
  type CanvasTargets,
} from './canvasExtensibility';
import './CanvasExtensibilityScene.css';

function CanvasField({
  lang,
  reduced,
}: {
  lang: 'zh' | 'en';
  reduced: boolean;
}): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { progress } = useAnimateTimeline();
  const descriptionId = `canvas-extensibility-description-${lang}`;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    const mask = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (!context || !mask) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let targets: CanvasTargets | null = null;
    let visible = typeof IntersectionObserver === 'undefined';
    let disposed = false;
    let colors = { ink: '#352820', accent: '#994f36', line: '#a4814c' };

    const rebuildTargets = (): void => {
      const style = getComputedStyle(canvas);
      colors = {
        ink: style.color || '#352820',
        accent: style.getPropertyValue('--burnt-terracotta').trim() || '#994f36',
        line: style.getPropertyValue('--brass-clay').trim() || '#a4814c',
      };
      targets = buildCanvasTargets(
        mask,
        width,
        height,
        style.getPropertyValue('--font-display').trim() || 'Georgia, serif',
        lang
      );
    };

    const resize = (nextWidth: number, nextHeight: number): void => {
      if (
        nextWidth === width &&
        nextHeight === height &&
        dpr === Math.min(window.devicePixelRatio || 1, 2)
      ) {
        return;
      }
      width = nextWidth;
      height = nextHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      rebuildTargets();
      draw();
    };

    const draw = (): void => {
      if (disposed || !targets || !visible || document.hidden) return;
      if (targets.particleCount === 0) {
        canvas.removeAttribute('data-canvas-ready');
        return;
      }
      drawCanvasTargets(context, targets, reduced ? 1 : progress.get(), {
        dpr,
        ink: colors.ink,
        accent: colors.accent,
        line: colors.line,
      });
      canvas.dataset.canvasReady = 'true';
      canvas.dataset.progress = String(reduced ? 1 : progress.get());
      canvas.dataset.particleCount = String(targets.particleCount);
    };

    const measure = (): void => {
      const rect = canvas.getBoundingClientRect();
      resize(rect.width, rect.height);
    };
    measure();

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(([entry]) =>
            resize(entry.contentRect.width, entry.contentRect.height)
          );
    resizeObserver?.observe(canvas);

    const intersectionObserver =
      typeof IntersectionObserver === 'undefined'
        ? undefined
        : new IntersectionObserver(
            ([entry]) => {
              // Threshold 0 can report edge contact once, before any pixels overlap.
              visible = entry.isIntersecting;
              canvas.dataset.visible = String(visible);
              if (visible) draw();
            },
            { root: canvas.closest('[data-cineview-container="true"]') }
          );
    intersectionObserver?.observe(canvas);

    const unsubscribe = progress.on('change', draw);
    const visibilityChange = (): void => {
      if (!document.hidden) draw();
    };
    document.addEventListener('visibilitychange', visibilityChange);
    window.addEventListener('resize', measure);
    const fontReady = (): void => {
      if (disposed || !width || !height) return;
      rebuildTargets();
      draw();
    };
    void document.fonts?.ready.then(fontReady);
    document.fonts?.addEventListener('loadingdone', fontReady);

    return (): void => {
      disposed = true;
      unsubscribe();
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      document.removeEventListener('visibilitychange', visibilityChange);
      window.removeEventListener('resize', measure);
      document.fonts?.removeEventListener('loadingdone', fontReady);
    };
  }, [lang, progress, reduced]);

  return (
    <div className="canvas-extensibility__field">
      <canvas
        ref={canvasRef}
        className="canvas-extensibility__canvas"
        role="img"
        aria-describedby={descriptionId}
        data-motion={reduced ? 'static' : 'scroll'}
      />
      <span className="canvas-extensibility__fallback" aria-hidden="true">
        {CANVAS_COPY[lang][reduced ? 4 : 0].map((line) => (
          <span key={line}>{line}</span>
        ))}
      </span>
      <p id={descriptionId} className="canvas-extensibility__sr-description">
        {CANVAS_COPY[lang]
          .map((lines) => lines.join(lang === 'zh' ? '' : ' '))
          .join(lang === 'zh' ? '。' : '. ')}
      </p>
    </div>
  );
}

export function CanvasExtensibilityScene(): React.JSX.Element {
  const { lang } = useI18n();
  const reduced = usePrefersReducedMotion();

  return (
    <section className="canvas-extensibility" data-lang={lang}>
      <Animate
        animateId="s04-canvas-extensibility"
        enterAnimation={{ initial: { opacity: 1 }, animate: { opacity: 1 } }}
        exitAnimation={{ exit: { opacity: 1 } }}
        duration={{ enter: reduced ? 0 : CANVAS_ZONE_MS, exit: 0 }}
        timeline={{ driver: 'scene' }}
      >
        <div className="canvas-extensibility__stage">
          <CanvasField lang={lang} reduced={reduced} />
        </div>
      </Animate>
    </section>
  );
}
