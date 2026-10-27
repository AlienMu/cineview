// React 19 with the 2.0 elements (plan v3 §3.6, F13): props as attributes or properties, oncv-*
// listeners, client render and SSR markup + hydration, cineview defined before or after React,
// drag or scroll input. Listeners through a ref log with an `fx-` prefix.
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';

declare global {
  interface Window {
    reactLog: string[];
    setLang: (lang: string) => void;
    setPaused: (paused: boolean) => void;
    setAfter: (after: string) => void;
  }
}
window.reactLog = [];
const log = (line: string): void => void window.reactLog.push(line);

const q = new URLSearchParams(location.search);
const input = q.get('input') === 'scroll' ? 'scroll' : 'drag';

function App(): ReactElement {
  const stage = useRef<HTMLElement>(null);
  useEffect(() => {
    const s = stage.current!;
    const onEnter = (e: Event): void => {
      const { from, to } = (e as CustomEvent<{ from: number; to: number }>).detail;
      log(`fx-enter:${from}>${to}`);
    };
    s.addEventListener('cv-enter', onEnter);
    // Defined later when the module loads after React (order=late).
    void customElements
      .whenDefined('cv-stage')
      .then(() => (s as HTMLElement & { ready: Promise<void> }).ready)
      .then(() => log('fx-ready'));
    return () => s.removeEventListener('cv-enter', onEnter);
  }, []);
  const [lang, setLang] = useState('en');
  const [paused, setPaused] = useState(false);
  const [after, setAfter] = useState('intro');
  window.setLang = setLang;
  window.setPaused = setPaused;
  window.setAfter = setAfter;
  return (
    <cv-stage
      ref={stage}
      id="s"
      input={input}
      transition-duration={400}
      paused={paused}
      oncv-ready={() => log('ready')}
      oncv-enter={(e) => log(`enter:${e.detail.from}>${e.detail.to}`)}
      oncv-error={(e) => log(`error:${e.detail.code}`)}
    >
      <cv-scene id="s0" aria-label={lang === 'en' ? 'Start' : 'Début'}>
        <cv-animate id="a0" name="intro" fx="fade">
          <p>{lang === 'en' ? 'Hello' : 'Bonjour'}</p>
        </cv-animate>
        <cv-animate id="a1" after={after} fx="rise">
          <p>two</p>
        </cv-animate>
      </cv-scene>
      <cv-scene id="s1">
        <p>one</p>
      </cv-scene>
    </cv-stage>
  );
}

const root = document.getElementById('root')!;
const load = (): Promise<unknown> => import('@v2');
if (q.get('order') !== 'late') await load();
if (q.get('mode') === 'hydrate') {
  root.innerHTML = renderToString(<App />);
  hydrateRoot(root, <App />, {
    onRecoverableError: (error) => log(`recoverable:${String(error)}`),
  });
} else {
  createRoot(root).render(<App />);
}
if (q.get('order') === 'late') {
  await new Promise((r) => setTimeout(r, 100));
  await load();
}
