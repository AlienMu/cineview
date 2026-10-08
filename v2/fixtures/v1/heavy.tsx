// Fixture (c), 1.x version: same author content; React mount/unmount (1.x virtualization) starts and stops it.
import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Animate, Cineview, Scene, type CineviewRef } from 'cineview';
import { attachVideo, copyBlock, startParticles } from '../heavy-author.js';

interface HeavyConfig {
  mode: 'scroll' | 'drag';
  scenes: number;
  animations: number;
  copy?: number;
}
interface Audit {
  api: CineviewRef | null;
  ready: boolean;
  mountStart: number;
  readyAt: number;
  errors: unknown[];
}
const fixtureWindow = window as unknown as { audit: Audit; mountFixture: (c: HeavyConfig) => void };

const root = createRoot(document.getElementById('root')!);
const audit: Audit = (fixtureWindow.audit = {
  api: null,
  ready: false,
  mountStart: 0,
  readyAt: 0,
  errors: [],
});
const rise = { initial: { opacity: 0, y: 40 }, animate: { opacity: 1, y: 0 } };
const reveal = {
  initial: { opacity: 0.34, scale: 1.06, filter: 'blur(6px)' },
  animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
};
const fade = { initial: { opacity: 0 }, animate: { opacity: 1 } };
const kinds = [rise, reveal, fade, rise];

function Heavy({ animations, copy }: { animations: number; copy: number }): React.JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const a = startParticles(canvas.current!);
    const b = attachVideo(video.current!);
    return () => {
      a();
      b();
    };
  }, []);
  return (
    <div className="heavy">
      <canvas ref={canvas} />
      <video ref={video} />
      <div className="ui">
        {Array.from({ length: animations }, (_, n) => (
          <Animate
            key={n}
            animateId={`a${n}`}
            duration={{ enter: 800 }}
            timeline={{ delay: (n % 4) * 60 }}
            enterAnimation={kinds[n % 4]}
          >
            <div className={n % 4 === 1 ? 'photo' : 'cell'} />
          </Animate>
        ))}
      </div>
      <div className="copy" dangerouslySetInnerHTML={{ __html: copyBlock(copy) }} />
    </div>
  );
}

function Fixture(config: HeavyConfig): React.JSX.Element {
  const ref = useRef<CineviewRef>(null);
  useEffect(() => {
    audit.api = ref.current;
  }, []);
  return (
    <Cineview
      ref={ref}
      mode={config.mode}
      direction="y"
      designWidth={390}
      transitionDuration={180}
      callbacks={{
        onReady: () => {
          audit.readyAt = performance.now();
          audit.ready = true;
        },
      }}
    >
      {Array.from({ length: config.scenes }, (_, i) => (
        <Scene
          key={i}
          sceneId={`s${i}`}
          layout={{ height: '100vh' }}
          scroll={config.mode === 'scroll' ? { zoneId: `z${i}` } : undefined}
        >
          <Heavy animations={config.animations} copy={config.copy ?? 40} />
        </Scene>
      ))}
    </Cineview>
  );
}

fixtureWindow.mountFixture = (config: HeavyConfig): void => {
  audit.ready = false;
  audit.mountStart = performance.now();
  root.render(<Fixture key={JSON.stringify(config)} {...config} />);
};
