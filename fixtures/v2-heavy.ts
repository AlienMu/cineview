import '@v2';
import { attachVideo, copyBlock, startParticles } from './heavy-author.js';

/** Fixture (c), 2.0 version. author: 'naive' starts all canvases/videos at load; 'contract' uses cv-activate/cv-deactivate. */
interface HeavyConfig {
  mode: 'drag' | 'scroll';
  scenes: number;
  animations: number;
  copy?: number;
  author?: 'naive' | 'contract';
  fallback?: boolean;
}
interface Audit {
  api: { getCurrentIndex(): number } | null;
  ready: boolean;
  mountStart: number;
  readyAt: number;
  errors: string[];
}
interface StageElement extends HTMLElement {
  currentIndex(): number;
}
const fixtureWindow = window as unknown as {
  audit: Audit;
  mountFixture: (config: HeavyConfig) => void;
};
const audit: Audit = (fixtureWindow.audit = {
  api: null,
  ready: false,
  mountStart: 0,
  readyAt: 0,
  errors: [],
});
const root = document.getElementById('root')!;
const presets = ['rise', 'reveal(left)', 'fade', 'rise'];

fixtureWindow.mountFixture = (config: HeavyConfig): void => {
  audit.ready = false;
  audit.mountStart = performance.now();
  let html = `<cv-stage input="${config.mode}" transition-duration="180"${config.fallback ? ' fallback' : ''}>`;
  for (let s = 0; s < config.scenes; s++) {
    html += `<cv-scene${config.mode === 'scroll' ? ' zone' : ''} style="height:100vh"><div class="heavy"><canvas></canvas><video></video><div class="ui">`;
    for (let n = 0; n < config.animations; n++) {
      const fx = presets[n % presets.length]!;
      html += `<cv-animate fx="${fx}" duration="800" delay="${(n % 4) * 60}"><div class="${fx.startsWith('reveal') ? 'photo' : 'cell'}"></div></cv-animate>`;
    }
    html += `</div><div class="copy">${copyBlock(config.copy ?? 40)}</div></div></cv-scene>`;
  }
  root.innerHTML = html + '</cv-stage>';
  const stage = root.querySelector('cv-stage') as StageElement;
  const stops = new Map<Element, Array<() => void>>();
  const start = (scene: Element) => {
    if (stops.has(scene)) return;
    stops.set(scene, [
      startParticles(scene.querySelector('canvas')!),
      attachVideo(scene.querySelector('video')!),
    ]);
  };
  const stop = (scene: Element) => {
    for (const f of stops.get(scene) ?? []) f();
    stops.delete(scene);
  };
  if (config.author === 'contract') {
    stage.addEventListener('cv-activate', (e: Event) => start(e.target as Element));
    stage.addEventListener('cv-deactivate', (e: Event) => stop(e.target as Element));
  } else {
    for (const scene of stage.querySelectorAll('cv-scene')) start(scene);
  }
  stage.addEventListener('cv-ready', () => {
    audit.readyAt = performance.now();
    audit.ready = true;
  });
  audit.api = { getCurrentIndex: () => stage.currentIndex() };
};
