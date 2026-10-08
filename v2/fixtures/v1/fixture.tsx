// 1.x gate fixture. Capacity workload copied from review/mobile-runtime-audit-20261007/browser/fixture.tsx;
// adds in-page ready timing and a preset-mix workload (1.x has no clip-path or view progress, so the
// mix uses its closest equivalents: blur+opacity+scale for reveal, zone scrub for drift).
import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Animate, Cineview, Scene, type CineviewRef } from 'cineview';

interface Config {
  mode: 'scroll' | 'drag';
  scenes: number;
  animations: number;
  workload?: 'capacity' | 'mix';
  driver?: 'scene' | 'clock';
}
interface Audit {
  api: CineviewRef | null;
  mounted: number;
  errors: unknown[];
  ready: boolean;
  mountStart: number;
  readyAt: number;
  config: Config | null;
}
const fixtureWindow = window as unknown as {
  audit: Audit;
  mountFixture: (c: Config) => void;
  unmountFixture: () => void;
};

const root = createRoot(document.getElementById('root')!);
const audit: Audit = (fixtureWindow.audit = {
  api: null,
  mounted: 0,
  errors: [],
  ready: false,
  mountStart: 0,
  readyAt: 0,
  config: null,
});
const enter = {
  initial: { opacity: 0.2, x: -20, scale: 0.9 },
  animate: { opacity: 1, x: 0, scale: 1 },
};
const exit = { exit: { opacity: 0.2, x: 20, scale: 0.9 } };
const rise = { initial: { opacity: 0, y: 40 }, animate: { opacity: 1, y: 0 } };
const reveal = {
  initial: { opacity: 0.34, scale: 1.06, filter: 'blur(6px)' },
  animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
};
const drift = (s: number) => ({ initial: { y: s }, animate: { y: -s } });

function cell(
  workload: string,
  n: number,
  driver: 'scene' | 'clock',
  mode: string
): React.JSX.Element {
  const common = { key: n, animateId: `a${n}`, timeline: { driver } };
  if (workload === 'mix') {
    const kind = n % 4;
    if (kind === 0 || kind === 3)
      return (
        <Animate {...common} duration={{ enter: 800 }} enterAnimation={rise}>
          <div style={{ background: '#b3ded6', height: '100%' }} />
        </Animate>
      );
    if (kind === 1)
      return (
        <Animate {...common} duration={{ enter: 800 }} enterAnimation={reveal}>
          <div className="photo" />
        </Animate>
      );
    return (
      <Animate {...common} duration={{ enter: 800 }} enterAnimation={drift(n % 2 ? 24 : 48)}>
        <div style={{ background: '#b3ded6', height: '100%' }} />
      </Animate>
    );
  }
  return (
    <Animate
      {...common}
      duration={{ enter: 800, exit: 300 }}
      enterAnimation={enter}
      exitAnimation={mode === 'drag' && driver === 'clock' ? undefined : exit}
    >
      <div style={{ background: '#b3ded6', height: '100%', width: '100%', minHeight: 4 }} />
    </Animate>
  );
}

function Content({
  index,
  animations,
  driver,
  mode,
  workload = 'capacity',
}: Config & { index: number; driver: 'scene' | 'clock' }): React.JSX.Element {
  useEffect(() => {
    audit.mounted++;
    return () => {
      audit.mounted--;
    };
  }, []);
  const columns = Math.ceil(Math.sqrt(animations));
  return (
    <div
      style={{
        height: '100%',
        background: index % 2 ? '#162f36' : '#23314c',
        padding: 40,
        display: 'grid',
        gridTemplateColumns: `repeat(${columns},minmax(0,1fr))`,
        gridTemplateRows: `repeat(${Math.ceil(animations / columns)},minmax(0,1fr))`,
        gap: 2,
      }}
    >
      {Array.from({ length: animations }, (_, n) => cell(workload, n, driver, mode))}
    </div>
  );
}

function Fixture(config: Config): React.JSX.Element {
  const ref = useRef<CineviewRef>(null);
  const driver = config.driver ?? 'scene';
  useEffect(() => {
    audit.api = ref.current;
    return () => {
      audit.api = null;
    };
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
        onError: (error: unknown) => audit.errors.push(error),
      }}
    >
      {Array.from({ length: config.scenes }, (_, index) => (
        <Scene
          key={index}
          sceneId={`s${index}`}
          layout={{ height: '100vh' }}
          scroll={
            config.mode === 'scroll' && driver === 'scene' ? { zoneId: `z${index}` } : undefined
          }
        >
          <Content index={index} {...config} driver={driver} />
        </Scene>
      ))}
    </Cineview>
  );
}

fixtureWindow.mountFixture = (config: Config): void => {
  audit.ready = false;
  audit.errors = [];
  audit.config = config;
  audit.mountStart = performance.now();
  root.render(<Fixture key={JSON.stringify(config)} {...config} />);
};
fixtureWindow.unmountFixture = (): void => root.render(null);
