import { Animate, useAnimateTimeline, type AnimatePhase } from 'cineview';
import { memo, useEffect, useRef, type ReactNode } from 'react';
import { useTemporalMotion } from './TemporalMotion';

interface Mote {
  x: number;
  y: number;
  z: number;
  drift: number;
  rise: number;
  twinkle: number;
}

type AmbientLoopProps = {
  id: string;
  className: string;
  animate: Record<string, unknown>;
  seconds: number;
  children?: ReactNode;
};

function AmbientLoop({ id, className, animate, seconds, children }: AmbientLoopProps): JSX.Element {
  const timing = useTemporalMotion();

  if (timing.reduced) return <div className={className}>{children}</div>;

  return (
    <Animate
      animateId={id}
      infiniteAnimation={{
        animate: {
          ...animate,
          transition: {
            duration: timing.seconds(seconds),
            ease: 'easeInOut',
            repeat: Infinity,
          },
        },
      }}
    >
      <div className={className}>{children}</div>
    </Animate>
  );
}

function AmbientDust(): JSX.Element {
  const { phase } = useAnimateTimeline();
  const { reduced } = useTemporalMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    const resize = (): void => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const vw = window.innerWidth;
    const count = vw <= 380 ? 34 : vw <= 600 ? 48 : 70;
    const motes: Mote[] = Array.from({ length: count }, () => ({
      x: Math.random(),
      y: Math.random(),
      z: Math.random(),
      drift: (Math.random() - 0.5) * 8,
      rise: 4 + Math.random() * 10,
      twinkle: Math.random() * Math.PI * 2,
    }));

    const inactive = (next: AnimatePhase): boolean => next === 'idle' || next === 'exited';
    let raf = 0;
    let phasePaused = inactive(phase.get());
    let hidden = document.visibilityState !== 'visible';
    let last = performance.now();

    const tick = (now: number): void => {
      raf = 0;
      if (phasePaused || hidden) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.clearRect(0, 0, width, height);

      for (const mote of motes) {
        mote.x += (mote.drift * dt) / width;
        mote.y -= (mote.rise * (0.4 + mote.z) * dt) / height;
        if (mote.y < -0.02) {
          mote.y = 1.02;
          mote.x = Math.random();
        }
        if (mote.x < -0.02) mote.x = 1.02;
        if (mote.x > 1.02) mote.x = -0.02;

        const shimmer = 0.5 + 0.5 * Math.sin(now / 900 + mote.twinkle);
        ctx.globalAlpha = (0.05 + mote.z * 0.18) * shimmer;
        ctx.fillStyle = '#ece3d0';
        ctx.beginPath();
        ctx.arc(mote.x * width, mote.y * height, 0.6 + mote.z * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };

    const start = (): void => {
      if (raf || phasePaused || hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const stop = (): void => {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const applyPhase = (next: AnimatePhase): void => {
      phasePaused = inactive(next);
      if (phasePaused) stop();
      else start();
    };
    const onVisibility = (): void => {
      hidden = document.visibilityState !== 'visible';
      if (hidden) stop();
      else start();
    };

    document.addEventListener('visibilitychange', onVisibility);
    const unsubscribePhase = phase.on('change', applyPhase);
    start();

    return () => {
      stop();
      unsubscribePhase();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [phase, reduced]);

  return <canvas ref={canvasRef} className="tp-ambient__dust" />;
}

/** Act 1's scene-owned ambient light. Every temporal property runs on CineView's lanes. */
export const AmbientStage = memo(function AmbientStage(): JSX.Element {
  const timing = useTemporalMotion();

  return (
    <Animate
      animateId="s01-ambient"
      enterAnimation={{
        initial: { opacity: 0.02, y: '22%', scale: 0.82 },
        animate: { opacity: 1, y: '0%', scale: 1 },
      }}
      exitAnimation={{ exit: { opacity: 0.02, y: '22%', scale: 0.82 } }}
      duration={{ enter: timing.duration(720), exit: timing.duration(720) }}
      timeline={{ delay: 0 }}
    >
      <div className="tp-ambient" aria-hidden="true">
        <div className="tp-ambient__rig">
          <AmbientLoop
            id="s01-ambient-key"
            className="tp-ambient__key"
            seconds={11}
            animate={{
              opacity: [0.55, 0.9, 0.55],
              scale: [1, 1.08, 1],
              x: ['0%', '2%', '0%'],
              y: ['0%', '-2%', '0%'],
            }}
          />
          <AmbientLoop
            id="s01-ambient-fill"
            className="tp-ambient__fill"
            seconds={14}
            animate={{
              opacity: [0.55, 0.9, 0.55],
              scale: [1, 1.08, 1],
              x: ['0%', '2%', '0%'],
              y: ['0%', '-2%', '0%'],
            }}
          />
          <AmbientLoop
            id="s01-ambient-ray-1"
            className="tp-ambient__ray"
            seconds={18}
            animate={{
              opacity: [0.4, 0.75, 0.4],
              rotate: [-8, 6, -8],
              x: ['-6%', '8%', '-6%'],
            }}
          />
          <AmbientLoop
            id="s01-ambient-ray-2"
            className="tp-ambient__ray tp-ambient__ray--2"
            seconds={23}
            animate={{
              opacity: [0.28, 0.55, 0.28],
              rotate: [7, -5, 7],
              x: ['6%', '-8%', '6%'],
            }}
          />
          <AmbientDust />
        </div>
      </div>
    </Animate>
  );
});
