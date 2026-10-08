import '@v2';

/** Same contract as the 1.x audit fixture: window.mountFixture(config) and window.audit. */
interface Config {
  mode: 'scroll' | 'drag';
  scenes: number;
  animations: number;
  workload?: 'capacity' | 'mix';
  driver?: 'scene' | 'clock';
  fallback?: boolean;
}

interface Audit {
  api: { getCurrentIndex(): number } | null;
  ready: boolean;
  mountStart: number;
  readyAt: number;
  errors: string[];
  config: Config | null;
}
interface StageElement extends HTMLElement {
  currentIndex(): number;
}
interface FixtureWindow {
  audit: Audit;
  mountFixture: (config: Config) => void;
  unmountFixture: () => void;
}
const fixtureWindow = window as unknown as FixtureWindow;

const audit: Audit = (fixtureWindow.audit = {
  api: null,
  ready: false,
  mountStart: 0,
  readyAt: 0,
  errors: [] as string[],
  config: null,
});
const root = document.getElementById('root')!;

function cell(kind: string, n: number): string {
  switch (kind) {
    case 'rise':
      return `<cv-animate fx="rise" duration="800"><div class="cell"></div></cv-animate>`;
    case 'reveal':
      return `<cv-animate fx="reveal(left)" duration="800"><div class="photo"></div></cv-animate>`;
    case 'drift':
      return `<cv-animate fx="drift(${n % 2 ? 'soft' : 'strong'})"><div class="cell"></div></cv-animate>`;
    case 'rise-drift':
      return `<cv-animate fx="rise, drift" duration="800"><div class="cell"></div></cv-animate>`;
    default:
      return `<cv-animate from="opacity:.2; x:-20; scale:.9" duration="800" exit="opacity:.2; x:20; scale:.9" exit-duration="300"><div class="cell"></div></cv-animate>`;
  }
}

function mix(n: number): string {
  return ['rise', 'reveal', 'drift', 'rise-drift'][n % 4]!;
}

fixtureWindow.mountFixture = (config: Config): void => {
  audit.ready = false;
  audit.errors = [];
  audit.config = config;
  root.textContent = '';
  audit.mountStart = performance.now();
  const columns = Math.ceil(Math.sqrt(config.animations));
  const rows = Math.ceil(config.animations / columns);
  const zone = config.mode === 'scroll' && (config.driver ?? 'scene') === 'scene' ? ' zone' : '';
  let html = `<cv-stage input="${config.mode}" design-width="390" transition-duration="180"${config.fallback ? ' fallback' : ''}>`;
  for (let s = 0; s < config.scenes; s++) {
    html += `<cv-scene${zone} style="height:100vh"><div class="grid" style="background:${s % 2 ? '#162f36' : '#23314c'};grid-template-columns:repeat(${columns},minmax(0,1fr));grid-template-rows:repeat(${rows},minmax(0,1fr))">`;
    for (let n = 0; n < config.animations; n++) {
      html += cell(config.workload === 'mix' ? mix(n) : 'capacity', n);
    }
    html += '</div></cv-scene>';
  }
  html += '</cv-stage>';
  root.innerHTML = html;
  const stage = root.querySelector('cv-stage') as StageElement;
  stage.addEventListener('cv-error', (e) =>
    audit.errors.push((e as CustomEvent<{ message: string }>).detail.message)
  );
  stage.addEventListener('cv-ready', () => {
    audit.readyAt = performance.now();
    audit.ready = true;
  });
  audit.api = { getCurrentIndex: () => stage.currentIndex() };
};
fixtureWindow.unmountFixture = (): void => {
  root.textContent = '';
};
