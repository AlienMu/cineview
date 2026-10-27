import '@v2';
import { contexts, getCapability } from '../gate/combinations.mjs';

const root = document.getElementById('root');
const picture = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="240"><rect width="480" height="240" fill="#e4c59a"/><path d="M0 190L110 60L230 150L350 30L480 140V240H0" fill="#306558"/><circle cx="390" cy="70" r="25" fill="#bd572f"/></svg>')}`;
const image = () =>
  `<img class="photo" src="${picture}" width="480" height="240" alt="Geometric subject" />`;
let dispose = () => {};
let stage = null;
let middle = null;
let controller = null;
let customAnimations = [];
let pageErrors = [];
let startTime = 0;
let readyMs = 0;
let events = [];
let currentCase = null;
let frames = 0;
const esc = (s) =>
  String(s).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const animate = (id, fx = '', content = '<div class="sample">Readable content</div>', attrs = '') =>
  `<cv-animate id="a-${id}" ${fx ? `fx="${esc(fx)}"` : ''} duration="1000" ease="linear" ${attrs}>${content}</cv-animate>`;
const scroller = (id, stop = false) =>
  `<div id="scroll-${id}" class="scroller ${stop ? 'stop' : ''}" ${id === 22 ? 'style="scroll-snap-type:none"' : ''} data-cv-ignore-drag tabindex="0" aria-label="Local gallery">${['One', 'Two', 'Three'].map((v) => `<div>${v}</div>`).join('')}</div>`;

function variant(name, reverse = false) {
  const node = (id, attrs = '', fx = 'fade', content = id) =>
    `<cv-animate id="${id}" name="${id}" fx="${fx}" ease="linear" ${attrs}><div class="sample">${content}</div></cv-animate>`;
  if (name === 'clock-chain' || name === 'after-offscreen') {
    const clock = name === 'clock-chain' ? 'on="clock"' : '';
    return (
      node('A', `${clock} duration="400" delay="100" replay`) +
      (name === 'after-offscreen' ? '<div style="height:1000px"></div>' : '') +
      node('B', `${clock} after="A -150" delay="50" duration="300"`) +
      node('C', `${clock} after="B -100" duration="200"`)
    );
  }
  if (name === 'exit-interruption')
    return node('A', 'duration="1000" exit="opacity:0; y:-16" exit-duration="400"', 'fade, rise');
  if (name === 'clock-completed-loop')
    return node('A', 'on="clock" duration="120" loop="pulse, pulse(strong)" loop-duration="600"');
  if (name === 'after-long-follower')
    return (
      node('A', 'duration="120"') +
      '<div style="height:1200px"></div>' +
      node('B', 'after="A" duration="1200"')
    );
  if (name === 'view-ranges' || name === 'view-ranges-split')
    return node(
      'pair',
      `on="view(self)" ${name.endsWith('split') ? 'split="words"' : ''}`,
      reverse ? 'fade exit, fade entry' : 'fade entry, fade exit',
      'Range subject'
    );
  if (name === 'after')
    return (
      node('A', 'duration="400" delay="100" exit="fade" exit-duration="100"') +
      node('B', 'after="A +100" delay="50" duration="300" exit="fade" exit-duration="200"') +
      node('C', 'after="B -200" duration="300" exit="fade" exit-duration="300"')
    );
  if (name === 'sequence')
    return (
      node('A', 'duration="200" exit="fade" exit-duration="100"') +
      node('B', 'duration="300" exit="fade" exit-duration="100"') +
      node('C', 'duration="400" exit="fade" exit-duration="100"')
    );
  if (name === 'at')
    return (
      node('A', 'duration="1000"') +
      node('B', 'at="25% 75%" duration="100" exit="fade" exit-duration="200"')
    );
  if (name === 'same-source')
    return node('A', 'duration="1000" exit="fade" exit-duration="200"', 'fade, rise');
  if (name === 'mixed-source') return node('A', 'duration="1000"', 'fade, drift(soft)');
  if (name === 'nested')
    return node('A', 'duration="1000"', 'fade', node('B', 'duration="1000"', 'fade'));
  if (name === 'count-split')
    return node('A', 'duration="1000" split="words"', 'count, fade', '128');
  if (name === 'clock') return node('A', 'duration="1000" on="clock"', 'fade');
  const pair = (fx, content, attrs = '') =>
    `<cv-animate id="pair" fx="${fx}" duration="1000" ease="linear" exit="opacity:0; y:-16" exit-duration="200" ${attrs}>${content}</cv-animate>`;
  if (name === 'loop-overlap')
    return node(
      'pair',
      `loop="${(reverse ? ['spin', 'sway', 'breathe(strong)', 'breathe', 'pulse(strong)', 'pulse', 'float(strong)', 'float'] : ['float', 'float(strong)', 'pulse', 'pulse(strong)', 'breathe', 'breathe(strong)', 'sway', 'spin']).join(', ')}" loop-duration="1000"`,
      '',
      'Composed loops'
    );
  if (name === 'pair-view')
    return pair('drift(soft), focus(band)', '<div class="sample">Shared depth subject</div>');
  if (name === 'pair-draw-wipe')
    return pair(
      'draw, wipe(left)',
      '<svg width="480" height="140" viewBox="0 0 480 140"><path id="pair-path" d="M10 120L130 20L250 110L470 10" fill="none" stroke="#306558" stroke-width="6"/></svg>'
    );
  if (name === 'pair-lines-axis')
    return pair(
      'rise(line), axis(wght 300 700)',
      '<div data-font class="words">First line<br>Second line</div>',
      'split="lines" stagger="60"'
    );
  if (name === 'pair-hue-rotation')
    return pair(
      'hue(0deg,180deg)',
      '<div class="sample" data-pair-color style="background:oklch(.8 .08 calc(120deg + var(--cv-hue,0deg)))"><div data-pair-rotation style="transform:rotate(calc(var(--scope,0)*90deg))">Scoped rotation</div></div>',
      'on="scene" from="--scope:0" to="--scope:1"'
    );
  if (name === 'pair-develop-duotone')
    return pair(
      'develop, duotone(terracotta)',
      `<img class="photo" src="/pair-delayed.svg" width="480" height="240" data-cv-standin="${picture}" alt="Delayed two-tone image">`
    );
  if (name) throw new Error(`Unknown variant ${name}`);
  return '';
}

function component(id, exits) {
  const out = exits ? 'exit="opacity:0; y:-16" exit-duration="200"' : '';
  switch (id) {
    case 1:
      return animate(id, '', '<div class="bar"></div>', 'on="page" from="--p:0" to="--p:1"');
    case 2:
      return animate(id, '', undefined, 'on="view(self)" from="opacity:.2" to="opacity:1"');
    case 3:
      return '<div class="sample" data-hold>Held composition; timeline below controls the explanation.</div>';
    case 4:
      return animate(id, 'drift(soft)', undefined, out);
    case 5:
      return '<div class="sample" data-track>Wide material; actual overflow determines travel.</div>';
    case 6:
      return `<cv-stack id="a-6" class="deck" duration="200" step="12"><div>Collect</div><div>Annotate</div><div>Explain</div></cv-stack>`;
    case 7:
      return animate(id, 'skew(soft)', undefined, out);
    case 8:
      return `<div id="subject-8" class="sample">Shared subject</div>${animate(id, 'fade', '<div class="caption">Matched explanation</div>', 'on="view(#subject-8)"')}`;
    case 9:
      return animate(
        id,
        'draw',
        '<svg viewBox="0 0 320 140" width="100%" height="140" aria-label="Connected process"><path d="M10 110L90 30L180 90L310 20" fill="none" stroke="#306558" stroke-width="6"/></svg>',
        out
      );
    case 10:
      return animate(
        id,
        'fade',
        '<p class="words">Collect material. Mark details. Explain the result.</p>',
        `split="words" stagger="60" ${out}`
      );
    case 11:
      return '<div class="sample">This Scene stays while the next one covers it.</div>';
    case 12:
      return animate(id, 'focus(band)', undefined, out);
    case 13:
      return animate(id, 'count', '<div class="words">128</div>', out);
    case 14:
      return scroller(id);
    case 15:
      return scroller(id, true);
    case 16:
      return `<nav aria-label="Scene markers"><a href="#before">Before</a> <a href="#middle">Current</a> <a href="#after">After</a></nav>`;
    case 17:
      return '<button type="button" data-next>Next scene</button>';
    case 18:
    case 19:
      return '<div class="sample">Managed Scene state</div>';
    case 20:
      return '<div class="sample" data-direction>Direction appears on the Stage.</div>';
    case 21:
      return '<div class="sample" data-gap>Unsupported: finite Stage does not wrap.</div>';
    case 22:
      return scroller(id);
    case 23:
      return '<nav aria-label="Contents"><a href="#middle">Explanation</a> <a href="#after">Result</a></nav>';
    case 24:
      return scroller(id);
    case 25:
      return animate(id, 'develop', image(), out);
    case 26:
      return `<div class="image-frame" data-ken>${image()}${image().replace('class="photo"', 'class="photo" style="position:absolute;inset:0;filter:hue-rotate(100deg)"')}</div>`;
    case 27:
      return animate(id, 'duotone(terracotta)', image(), out);
    case 28:
      return `<div class="image-frame">${image()}<div data-blur style="position:absolute;inset:0;pointer-events:none">${[2, 4, 8].map((blur, i) => `<img src="${picture}" alt="" style="position:absolute;inset:0;filter:blur(${blur}px);mask-image:linear-gradient(to top,#000 ${i * 12}%,transparent ${35 + i * 15}%)">`).join('')}</div></div>`;
    case 29:
      return '<canvas width="128" height="96" aria-label="Prepared ordered dither"></canvas>';
    case 30:
      return animate(id, 'wipe(left)', undefined, out);
    case 31:
      return `<div class="image-frame" data-compare>${image()}<img src="${picture}" alt="Processed result" style="position:absolute;inset:0;filter:grayscale(1);clip-path:inset(0 50% 0 0)"></div><input type="range" min="0" max="100" value="50" aria-label="Compare images">`;
    case 32:
      return animate(
        id,
        'rise(line)',
        '<div class="words">Readable first line<br>Readable second line</div>',
        `split="lines" stagger="60" ${out}`
      );
    case 33:
      return animate(
        id,
        'axis(wght 300 700)',
        '<div class="words" data-font>Variable type</div>',
        out
      );
    case 34:
      return '<div class="mask-text">FORM</div>';
    case 35:
      return '<div class="vertical" lang="zh-CN">内容与形式<br>排版与节奏</div>';
    case 36:
      return '<div class="marquee"><div data-marquee><span>One useful explanation. Another clear detail.</span><span aria-hidden="true" inert>One useful explanation. Another clear detail.</span></div></div>';
    case 37:
      return animate(
        id,
        'hue(0deg, 180deg)',
        '<div class="sample" style="background:oklch(.8 .08 calc(120deg + var(--cv-hue,0deg)))">Related palette</div>',
        out
      );
    case 38:
      return animate(
        id,
        '',
        '<div class="sample" data-rotation style="transform:rotate(calc(var(--scope,0)*90deg))">Locally scoped rotation</div>',
        `from="--scope:0" to="--scope:1" ${out}`
      );
    case 39:
      return '<div class="sample" data-gamut style="background:color-mix(in oklch,#c46a39 calc(var(--local,0)*100%),#427e92)">Authored color route</div>';
    case 40:
      return animate(
        id,
        'invert',
        '<div class="words" style="background:linear-gradient(90deg,#000,#fff)">Contrast check</div>',
        out
      );
    case 41:
      return '<div class="sample">Chapter palette roles</div>';
    default:
      throw new Error(`Unknown reference ${id}`);
  }
}

function dither(canvas) {
  const context = canvas.getContext('2d');
  const data = context.createImageData(canvas.width, canvas.height);
  // Bayer's recursive matrix; fixed pattern, not random noise.
  let matrix = [[0]];
  while (matrix.length < 8) {
    const n = matrix.length,
      next = Array.from({ length: n * 2 }, () => Array(n * 2));
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const a = matrix[y][x] * 4;
        next[y][x] = a;
        next[y][x + n] = a + 2;
        next[y + n][x] = a + 3;
        next[y + n][x + n] = a + 1;
      }
    matrix = next;
  }
  for (let y = 0; y < canvas.height; y++)
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4,
        v = x / canvas.width > (matrix[y % 8][x % 8] + 0.5) / 64 ? 255 : 0;
      data.data.set([v, v, v, 255], i);
    }
  context.putImageData(data, 0, 0);
}

function setupPageWork(ids, signal) {
  for (const tile of root.querySelectorAll('[data-ref]')) {
    const id = Number(tile.dataset.ref);
    if (id === 17)
      tile.querySelector('button').addEventListener('click', () => stage.goTo('after'), { signal });
    if (id === 29) dither(tile.querySelector('canvas'));
    if (id === 31)
      tile.querySelector('input').addEventListener(
        'input',
        (event) => {
          tile.querySelector('[data-compare] img:last-child').style.clipPath =
            `inset(0 ${100 - Number(event.target.value)}% 0 0)`;
        },
        { signal }
      );
    if (id === 22) {
      const el = tile.querySelector('.scroller');
      let press = null,
        raf = 0;
      const stop = () => {
        cancelAnimationFrame(raf);
        raf = 0;
      };
      el.addEventListener(
        'pointerdown',
        (event) => {
          stop();
          press = { x: event.clientX, t: performance.now(), v: 0 };
          el.setPointerCapture(event.pointerId);
        },
        { signal }
      );
      el.addEventListener(
        'pointermove',
        (event) => {
          if (!press) return;
          const t = performance.now(),
            dx = press.x - event.clientX;
          el.scrollLeft += dx;
          press.v = dx / Math.max(1, t - press.t);
          press.x = event.clientX;
          press.t = t;
        },
        { signal }
      );
      el.addEventListener(
        'pointerup',
        () => {
          let velocity = press?.v ?? 0;
          press = null;
          const tick = () => {
            velocity *= 0.9;
            el.scrollLeft += velocity * 16;
            if (Math.abs(velocity) > 0.05) raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        },
        { signal }
      );
      el.addEventListener(
        'pointercancel',
        () => {
          press = null;
          stop();
        },
        { signal }
      );
      signal.addEventListener('abort', stop, { once: true });
    }
    if (id === 26) {
      for (const [index, img] of [...tile.querySelectorAll('img')].entries()) {
        const animation = img.animate(
          [
            {
              offset: 0,
              transform: 'translate(-2%,0) scale(1.1)',
              transformOrigin: '25% 40%',
              opacity: index ? 0 : 1,
            },
            { offset: 0.42, opacity: index ? 0 : 1 },
            { offset: 0.58, opacity: index ? 1 : 0 },
            {
              offset: 1,
              transform: 'translate(2%,-1%) scale(1.18)',
              transformOrigin: '65% 50%',
              opacity: index ? 1 : 0,
            },
          ],
          { duration: 12000, iterations: Infinity, direction: 'alternate', easing: 'linear' }
        );
        animation.pause();
        customAnimations.push(animation);
      }
    }
    if (id === 36) {
      const band = tile.querySelector('[data-marquee]'),
        width = band.firstElementChild.getBoundingClientRect().width;
      const animation = band.animate([{ translate: '0 0' }, { translate: `-${width}px 0` }], {
        duration: (width / 30) * 1000,
        iterations: Infinity,
        easing: 'linear',
      });
      animation.pause();
      customAnimations.push(animation);
    }
  }
  // Page-owned work is paused with this fixture's controls, not automatically by Cineview.
  middle.addEventListener('cv-deactivate', () => customAnimations.forEach((a) => a.pause()), {
    signal,
  });
  middle.addEventListener('cv-enter', () => customAnimations.forEach((a) => a.play()), {
    signal,
  });
  middle.addEventListener('cv-leave', () => customAnimations.forEach((a) => a.pause()), { signal });
}

async function mount(config) {
  dispose();
  history.scrollRestoration = 'manual';
  scrollTo(0, 0);
  const context = contexts.find((c) => c.id === config.context);
  if (!context) throw new Error(`Unknown context ${config.context}`);
  currentCase = { ...config };
  pageErrors = [];
  frames = 0;
  events = [];
  startTime = performance.now();
  controller = new AbortController();
  const signal = controller.signal;
  const ids = config.ids;
  const exits = config.exits !== false;
  const stack = ids.some((id) => [11, 18].includes(id));
  const track = ids.includes(5);
  let tiles = ids
    .map(
      (id) =>
        `<section class="tile" data-ref="${id}"><h2>${id}. ${getCapability(id).name}</h2>${component(id, exits)}</section>`
    )
    .join('');
  if (config.copies > 1)
    tiles = Array.from({ length: config.copies }, (_, copy) =>
      tiles
        .replaceAll('id="', `data-copy="${copy}" id="copy-${copy}-`)
        .replaceAll('view(#', `view(#copy-${copy}-`)
    ).join('');
  root.innerHTML = `<cv-stage input="${context.input}" design-width="1280" transition-duration="800" ${context.fallback ? 'fallback' : ''}>
    <cv-scene id="before" theme="before"><div class="bookend">Before</div></cv-scene>
    <cv-scene id="middle" theme="middle" ${context.zone ? 'zone' : ''} ${stack ? 'stack covered="dim"' : ''} ${track ? 'track="x"' : ''} ${config.variant === 'sequence' ? 'sequence="50"' : ''}>
      <div class="sheet" style="${track ? 'min-width:calc(100vw + 600px)' : ''}">
        <h1>Composition ${ids.join(' + ')}</h1><div id="outside-scope">Unchanged outside</div>
        ${config.variant ? variant(config.variant, config.reverse) : animate('beacon', 'fade', '<div class="timeline"></div>', exits ? 'exit="fade" exit-duration="200"' : '')}
        <div class="grid">${tiles}</div>
      </div>
    </cv-scene>
    <cv-scene id="after" theme="last"><div class="bookend">After: actual readable content</div></cv-scene>
  </cv-stage>`;
  stage = root.querySelector('cv-stage');
  middle = root.querySelector('#middle');
  if (config.manualClock) {
    window.fixtureClockTime = 0;
    stage.clock.now = () => window.fixtureClockTime;
  }
  for (const type of ['cv-enter', 'cv-leave', 'cv-activate', 'cv-deactivate'])
    stage.addEventListener(
      type,
      (event) => events.push({ type, target: event.target.id, detail: event.detail }),
      { signal }
    );
  stage.addEventListener(
    'cv-error',
    (e) => pageErrors.push({ code: e.detail.code, message: e.detail.message }),
    { signal }
  );
  const ready = stage.ready;
  await ready;
  await Promise.all([...root.querySelectorAll('img')].map((img) => img.decode().catch(() => {})));
  await document.fonts.ready;
  readyMs = performance.now() - startTime;
  setupPageWork(ids, signal);
  const beacon = root.querySelector('#a-beacon');
  const unsubscribe = beacon?.timeline.subscribe((frame) => {
    frames++;
    const p = frame.phase === 'exiting' ? 1 - frame.progress : frame.progress;
    root
      .querySelectorAll('[data-gamut]')
      .forEach((el) => el.style.setProperty('--local', String(p)));
  });
  dispose = () => {
    unsubscribe?.();
    controller?.abort();
    customAnimations.forEach((a) => a.cancel());
    customAnimations = [];
    root.replaceChildren();
    stage = null;
    middle = null;
  };
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return snapshot();
}

function snapshot() {
  if (!stage)
    return {
      mounted: false,
      animations: document.getAnimations().length,
      nodes: root.querySelectorAll('*').length,
    };
  const sceneRect = middle.getBoundingClientRect();
  const properties = [...middle.querySelectorAll('cv-animate')].map((a) => ({
    id: a.id,
    timeline: { ...a.timeline.frame },
    layers: (a.layers ?? []).map((l) => {
      const style = getComputedStyle(l.el);
      return {
        source: l.source,
        native: !!l.native,
        opacity: Number(style.opacity),
        translate: style.translate,
        scale: style.scale,
        filter: style.filter,
        clip: style.clipPath,
        font: style.fontVariationSettings,
        vars: [...l.vars].map((v) => [v, style.getPropertyValue(v)]),
      };
    }),
  }));
  return {
    mounted: true,
    config: currentCase,
    input: stage.input,
    current: stage.current,
    readyMs,
    scrollY,
    sceneTop: sceneRect.top,
    sceneHeight: sceneRect.height,
    total: middle.solution?.total ?? null,
    errors: pageErrors,
    events: [...events],
    frames,
    properties,
    theme: stage.getAttribute('data-cv-theme'),
    ownAnimations: customAnimations.length,
    ownAnimationStates: customAnimations.map((a) => a.playState),
    animations: document.getAnimations().length,
    native: properties.flatMap((a) => a.layers).filter((l) => l.native).length,
    tiles: [...middle.querySelectorAll('[data-ref]')].map((el) => {
      const r = el.getBoundingClientRect();
      return { id: Number(el.dataset.ref), width: r.width, height: r.height };
    }),
    supported: {
      viewTimeline: typeof ViewTimeline !== 'undefined',
      scrollTimeline: typeof ScrollTimeline !== 'undefined',
      markers: CSS.supports('selector(::scroll-marker)'),
      snapped: CSS.supports('container-type: scroll-state'),
      colorMix: CSS.supports('color', 'color-mix(in oklch,red,blue)'),
    },
  };
}

export const bench = {
  mount,
  snapshot,
  unmount: () => dispose(),
  goTo: (target, animated = false) => stage.goTo(target, { animated }),
  pause: () => {
    stage.pause();
    customAnimations.forEach((a) => a.pause());
  },
  play: () => {
    stage.play();
    customAnimations.forEach((a) => a.play());
  },
  // Deterministic scroll positioning is separate from real-input acceptance.
  progress: (p) => {
    stage.refresh();
    const top = middle.docTop ?? middle.offsetTop;
    scrollTo(0, top + p * (middle.solution?.total ?? 0));
  },
};
window.bench = bench;
window.fixtureReady = true;
