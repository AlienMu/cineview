import { bench } from './combinations.js';
import './integrated.css';
import { defineEffect } from '@v2';
import { r2Material } from '../gate/authored-storyboard-page.mjs';

const delayedUrl = new URL('./media/integrated-document.svg', import.meta.url).href;
const videoUrl = new URL('./media/clip.webm', import.meta.url).href;
defineEffect('integrated-mark', {
  from: { draw: 0, rotate: -6 },
  to: { draw: 1, rotate: 0 },
  ease: 'linear',
  duration: 400,
});

const text = {
  en: {
    title: 'From material to meaning.',
    intro: 'Keep the source in view. Mark one detail, then connect it to an explanation.',
    eyebrow: 'Cineview / Field notes',
    before: 'One source. A readable explanation.',
    beforeText:
      'An illustrative workflow. The next scene combines animation and native controls around the same material.',
    after: 'The source and explanation stay connected.',
    afterText:
      'Three steps, aligned images and a complete reading state. This is illustrative material, not product statistics.',
    enter: 'Open field notes',
    return: 'Return to field notes',
    source: 'Compare the material',
    compare: 'Annotation boundary',
    steps: 'Three connected steps',
    explain: 'Read the explanation',
    browse: 'Browse the source list',
    detail: 'Look at the detail',
    state: 'Observe the state',
    native: 'Native controls · page owned',
    framework: 'Framework + page composition',
    count: 'illustrative records',
    line1: 'Keep the source.',
    line2: 'Explain the detail.',
    words: 'Collect Mark Explain',
    vertical: 'Read with context',
    masked: 'FIELD NOTES',
    paused: 'Resume motion',
    playing: 'Pause motion',
    next: 'Next',
    previous: 'Previous',
    kinetic: 'Local drag · no snap',
    pending: 'Material loading; controls remain available.',
    loaded: 'Source ready · same reserved size',
    clock: 'Clock',
    loop: 'Own periods: 5s + 8s',
    ticker: 'Source visible · explanation selectable · native controls available',
    action: 'Review complete',
    owner: 'Framework',
    page: 'Page',
    save: 'Saved locally for this example',
    cta: 'Save this example',
    progress: 'Page position',
    summary: 'A finite Scene collection; endless Stage wrapping is excluded.',
  },
  'zh-CN': {
    title: '从资料，到说明。',
    intro: '保留来源，标出细节，再把它与说明联系起来。',
    eyebrow: 'Cineview / 现场笔记',
    before: '同一份资料，一段完整说明。',
    beforeText: '这是一份示例流程。下一景围绕同一份资料组合动效与原生控件。',
    after: '来源与说明，始终对应。',
    afterText: '三步流程、对齐图片和完整阅读态。页面数字仅供示例。',
    enter: '打开现场笔记',
    return: '返回现场笔记',
    source: '对照原始资料',
    compare: '标注分界',
    steps: '连接三个步骤',
    explain: '阅读对应说明',
    browse: '浏览来源列表',
    detail: '观察图像细节',
    state: '观察当前状态',
    native: '原生控件 · 页面实现',
    framework: '框架与页面共同编排',
    count: '条示例记录',
    line1: '保留原始资料。',
    line2: '说明具体细节。',
    words: '收集 标记 说明',
    vertical: '连同上下文阅读',
    masked: '现场笔记',
    paused: '继续动态效果',
    playing: '暂停动态效果',
    next: '下一项',
    previous: '上一项',
    kinetic: '局部惯性拖动 · 无吸附',
    pending: '资料加载中，控件仍可使用。',
    loaded: '资料已准备，保留原有尺寸',
    clock: '独立时间',
    loop: '各自周期：5秒 + 8秒',
    ticker: '来源保持可见 · 正文可以选择 · 原生控件可用',
    action: '完成查看',
    owner: '框架',
    page: '页面',
    save: '此示例已在本页保存',
    cta: '保存这个示例',
    progress: '页面位置',
    summary: 'Stage 是有限场景集合；不提供无限首尾循环。',
  },
};

let current = null;
const uri = (svg) => `data:image/svg+xml,${encodeURIComponent(svg)}`;
const exit = 'exit="opacity:0; y:-16" exit-duration="200"';

/** One authored case. All configuration changes use this same content and owner. */
export async function mountIntegratedCase({
  context = 'zone-fallback',
  layout = 'grid',
  language = 'en',
  paused = false,
} = {}) {
  if (!text[language] || !['grid', 'track'].includes(layout))
    throw new Error('Unsupported integrated presentation');
  if (layout === 'track' && context.startsWith('enter'))
    throw new Error('A horizontal track is a scroll zone');
  current?.dispose();
  window.integratedReady = false;
  const pending = bench.mount({ ids: [], context, exits: false });
  const stage = document.querySelector('cv-stage'),
    scene = document.getElementById('middle');
  const copy = text[language],
    material = r2Material(language),
    images = ['A', 'B', 'C'].map((k) => uri(material.assets[k]));
  const abort = new AbortController(),
    signal = abort.signal,
    own = [],
    unsubscribers = [];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const state = {
    context,
    layout,
    language,
    stage,
    scene,
    copy,
    own,
    events: [],
    inputs: [],
    errors: [],
    markers: [],
    disposed: false,
    localRaf: 0,
    localVelocity: 0,
    saved: false,
    subscribedFrames: 0,
  };
  current = state;
  document.documentElement.lang = language;
  stage.setAttribute('unit', 'percent');
  stage.id = 'integrated-stage';
  stage.setAttribute('scale', '1');
  scene.className = layout === 'track' ? 'case-track' : '';
  scene.setAttribute('stack', '');
  scene.setAttribute('covered', 'dim');
  scene.setAttribute('sequence', '60');
  if (layout === 'track') scene.setAttribute('track', 'x');
  if (paused) stage.pause();
  document.getElementById('before').innerHTML =
    `<section class="case-bookend"><div class="case-eyebrow">${copy.eyebrow}</div><h1>${copy.before}</h1><p>${copy.beforeText}</p><a href="#middle">${copy.enter}</a></section>`;
  document.getElementById('after').innerHTML =
    `<section class="case-bookend"><div class="case-eyebrow">${copy.eyebrow}</div><h2>${copy.after}</h2><p>${copy.afterText}</p><p class="case-caption">${copy.summary}</p><a href="#middle">${copy.return}</a></section>`;
  scene.innerHTML = `<section class="case-sheet" aria-label="${copy.title}">
    <header class="case-header"><div><div class="case-eyebrow">${copy.eyebrow}</div><h1>${copy.title}</h1></div><div><cv-animate id="A" name="A" fx="fade, rise(soft)" delay="100" duration="400" ease="linear" ${exit}><p>${copy.intro}</p></cv-animate><div id="case-progress" class="case-progress"><cv-animate id="page-progress" on="page" from="--read:0" to="--read:1"><div class="case-progress-fill" aria-label="${copy.progress}"></div></cv-animate></div></div></header>
    <div class="case-row">
      <section class="case-module" data-module="source"><h2>${copy.source}</h2><div class="case-owner">01 / ${copy.native}</div>
        <div class="case-image" id="material-subject"><img src="${images[0]}" width="640" height="400" alt="${material.text.source}"/><img class="compare-after" src="${images[1]}" width="640" height="400" alt="${material.text.titles[1]}"/><div class="compare-line"></div></div>
        <label class="case-compare-control">${copy.compare}<input id="comparison" type="range" min="0" max="100" value="50" aria-label="${copy.compare}"/></label>
        <cv-animate id="B" name="B" class="case-path" fx="draw, wipe(left)" duration="300" ease="linear" ${exit}><svg viewBox="0 0 320 28" aria-label="${copy.steps}"><path d="M5 14H98L108 5L118 14H210L220 23L230 14H315" fill="none" stroke="#a95036" stroke-width="2"/></svg></cv-animate><cv-animate id="entry-note" fx="fade entry" on="view(#material-subject)" ease="linear"><span class="case-caption">01 ↔ 02</span></cv-animate>
      </section>
      <section class="case-module" data-module="steps"><h2>${copy.steps}</h2><div class="case-owner">02 / ${copy.owner} · sequence / after</div>
        <cv-stack id="deck" class="case-deck" duration="200" step="20" after="A +100" ease="linear">${material.text.titles.map((title, i) => `<article class="case-card"><strong>0${i + 1}. ${title}</strong><p>${material.text.descriptions[i]}</p></article>`).join('')}</cv-stack>
      </section>
      <section class="case-module" data-module="explain"><h2>${copy.explain}</h2><div class="case-owner">03 / ${copy.owner} · split / axis / count</div>
        <div class="case-number"><cv-animate id="C" name="C" fx="count" after="B +60" duration="200" ease="linear">128</cv-animate><span>${copy.count}</span></div>
        <cv-animate id="D" name="D" fx="fade, drift(soft)" duration="300" after="A +100" delay="50" ease="linear" ${exit}><p class="case-note">${material.text.titles[1]}</p></cv-animate>
        <cv-animate id="E" name="E" fx="grow, rotate-in" duration="300" after="B -200" ease="linear" ${exit}><p class="case-note">${material.text.titles[2]}</p></cv-animate>
        <cv-animate id="split-lines" class="case-copy" fx="rise(line), axis(wght 300 700)" split="lines" stagger="60" after="A" duration="600" ease="linear">${copy.line1}<br/>${copy.line2}</cv-animate>
        <cv-animate id="split-words" class="case-words" fx="fade" split="words" stagger="60" after="A" duration="600" ease="linear">${copy.words}</cv-animate>
        <div class="case-notes"><span class="case-vertical">${copy.vertical}</span><span class="case-textmask">${copy.masked}</span><cv-animate id="view-note" fx="fade" on="view(#material-subject)" ease="linear"><span class="case-note">A → B</span></cv-animate><cv-animate id="seal" class="case-seal" fx="keyframes(integrated-seal), reveal" after="A" duration="400" ease="linear">◈</cv-animate></div>
      </section>
    </div>
    <div class="case-row">
      <section class="case-module" data-module="browse"><h2>${copy.browse}</h2><div class="case-owner">04 / ${copy.native}</div>
        <div id="snap-gallery" class="case-gallery" data-cv-ignore-drag tabindex="0" aria-label="${copy.browse}">${images.map((src, i) => `<article><img src="${src}" width="640" height="400" alt=""/><span>0${i + 1}. ${material.text.titles[i]}</span></article>`).join('')}</div>
        <div class="case-gallery-controls"><button type="button" id="gallery-prev" aria-label="${copy.previous}" disabled>←</button><button type="button" id="gallery-next" aria-label="${copy.next}">→</button></div>
        <div id="kinetic-gallery" class="case-kinetic" data-cv-ignore-drag tabindex="0" aria-label="${copy.kinetic}">${['A/01', 'A/02', 'B/01', 'B/02', 'C/01', 'C/02'].map((x) => `<span>${x}</span>`).join('')}</div><p class="case-caption">${copy.kinetic}</p><cv-animate id="target-labels" fx="fade" after="A" duration="200" stagger="60" target="span" ease="linear"><span class="case-label">A</span> · <span class="case-label">B</span> · <span class="case-label">C</span></cv-animate>
      </section>
      <section class="case-module" data-module="detail"><h2>${copy.detail}</h2><div class="case-owner">05 / ${copy.framework}</div>
        <div class="case-detail-row"><cv-animate id="focus-band" fx="focus(band)"><div class="case-observe"><img data-pan src="${images[0]}" width="640" height="400" alt="${material.text.titles[0]}"/><img data-pan src="${images[2]}" width="640" height="400" alt="${material.text.titles[2]}"/><div class="case-blur"></div><div></div><span class="case-detail-label">pan / dissolve / blur</span></div></cv-animate><canvas id="dither" class="case-dither" width="48" height="80" aria-label="Ordered Bayer dither"></canvas></div>
        <div class="case-media-row"><cv-animate id="develop" fx="develop, duotone(terracotta), push(in)" after="A" duration="600" ease="linear"><img id="pending-image" width="640" height="400" src="${delayedUrl}" data-cv-standin="${images[0]}" alt="${material.text.source}"/></cv-animate><cv-video id="media" class="case-video" src="${videoUrl}" range="0 1" after="A" duration="1000" fx="fade" exit="fade" exit-duration="200" aria-label="Timeline video"></cv-video></div><p class="case-caption" id="image-status">${copy.pending}</p>
      </section>
      <section class="case-module" data-module="state"><h2>${copy.state}</h2><div class="case-owner">06 / ${copy.framework}</div>
        <div class="case-status"><cv-animate id="compass" class="case-compass" loop="sway, spin" ease="linear">✳</cv-animate><cv-animate id="velocity" fx="skew(soft)"><span class="case-meta">↕</span></cv-animate><output id="direction" class="case-meta">—</output><svg id="drawing" class="case-svg-meter" viewBox="0 0 60 26" aria-label="Timeline drawing"><path d="M1 24H59M1 12H59M1 1H59" stroke="#9cad98" fill="none"/><path id="drawing-fill" d="M1 24H1" stroke="#ae4e34" stroke-width="2" fill="none"/></svg></div>
        <div class="case-clock"><cv-animate id="CA" name="CA" on="clock" fx="fade" duration="500" ease="linear">${copy.clock} A</cv-animate><cv-animate id="CB" name="CB" on="clock" fx="unroll" after="CA -100" duration="400" ease="linear">B</cv-animate><cv-animate id="custom-mark" fx="integrated-mark" after="A" duration="400"><svg width="22" height="22" viewBox="0 0 22 22" aria-label="Custom effect"><path d="M3 11L8 16L19 4" stroke="#a95036" stroke-width="2" fill="none"/></svg></cv-animate></div>
        <p class="case-caption">${copy.loop} · <cv-pause id="framework-pause" for="integrated-stage">${copy.playing}</cv-pause></p><cv-animate id="G" after="A -500" fx="hue(0deg,180deg)" from="--scope:0" to="--scope:1" at="25% 75%" duration="100" ease="linear" exit="fade" exit-duration="200"><div class="case-palette">${copy.masked}<i>◇</i></div></cv-animate>
        <cv-animate id="F" name="F" after="A -500" from="--chapter:0" to="--chapter:1" duration="2400" ease="linear"><div class="case-gamut"></div></cv-animate>
        <div class="case-invert"><cv-animate id="inversion" fx="invert" after="A" duration="400"><span>Black / gray / white</span></cv-animate></div><p class="case-caption" id="state-note">${copy.progress}</p>
      </section>
    </div>
    <footer class="case-footer"><nav aria-label="Scene navigation"><a href="#before">01</a> / <a href="#middle">02</a> / <a href="#after">03</a></nav><div class="case-marquee"><div id="marquee"><span>${copy.ticker}</span><span aria-hidden="true" inert>${copy.ticker}</span></div></div><button id="save-example" type="button">${copy.cta}</button><a id="next-scene" href="#after">${copy.action} ↗</a></footer>
  </section><cv-fixed id="fixed-state"><span class="case-fixed-status">${copy.owner} · <output id="held-state">—</output></span></cv-fixed>`;
  const controls = document.getElementById('case-controls');
  controls.innerHTML = `<select id="case-context" aria-label="Input context">${[
    'drag',
    'zone-auto',
    'zone-fallback',
    'enter-auto',
    'enter-fallback',
  ]
    .filter((x) => layout !== 'track' || !x.startsWith('enter'))
    .map((x) => `<option ${x === context ? 'selected' : ''}>${x}</option>`)
    .join(
      ''
    )}</select><select id="case-layout" aria-label="Layout"><option ${layout === 'grid' ? 'selected' : ''}>grid</option><option ${layout === 'track' ? 'selected' : ''}>track</option></select><button id="case-language" type="button">${language === 'en' ? '中文' : 'EN'}</button><button id="case-pause" type="button" aria-pressed="${paused}">${paused ? copy.paused : copy.playing}</button><button id="case-replay" type="button">↺</button>`;
  const on = (node, type, fn, options = {}) =>
    node.addEventListener(type, fn, { ...options, signal });
  for (const type of [
    'cv-enter',
    'cv-leave',
    'cv-activate',
    'cv-deactivate',
    'cv-dragstart',
    'cv-dragend',
    'cv-dragcancel',
    'cv-progress',
    'cv-pause',
    'cv-play',
  ])
    on(stage, type, (e) => {
      if (type !== 'cv-progress')
        state.events.push({
          type,
          target: e.target.id,
          detail: e.detail,
          clock: stage.clock.now(),
        });
      else if (e.detail.kind === 'page')
        state.events.push({ type, detail: e.detail, clock: stage.clock.now() });
      syncOwn();
    });
  on(stage, 'cv-error', (e) => {
    e.preventDefault();
    state.errors.push({ ...e.detail, element: e.detail.element.id });
  });
  for (const type of [
    'pointerdown',
    'pointermove',
    'pointerup',
    'pointercancel',
    'click',
    'keydown',
    'keyup',
    'wheel',
    'input',
  ])
    on(
      document,
      type,
      (e) => {
        if (
          e.target === document.body ||
          e.target === document.documentElement ||
          e.target?.closest?.('#root,#case-controls')
        ) {
          const record = {
            type,
            target: e.target.id || e.target.localName,
            key: e.key,
            trusted: e.isTrusted,
            detail: e.detail,
            x: e.clientX,
            y: e.clientY,
            defaultPrevented: e.defaultPrevented,
            at: performance.now(),
          };
          state.inputs.push(record);
          setTimeout(() => {
            record.defaultPrevented = e.defaultPrevented;
          }, 0);
        }
      },
      { capture: true }
    );
  function syncOwn() {
    const active = stage.current === 1 && !stage.paused && !motion.matches;
    for (const a of own) {
      if (active) a.play();
      else a.pause();
    }
    controls.querySelector('#case-pause').setAttribute('aria-pressed', String(stage.paused));
    controls.querySelector('#case-pause').textContent = stage.paused ? copy.paused : copy.playing;
    document.getElementById('direction').textContent =
      stage.getAttribute('data-cv-direction') || '—';
    document.getElementById('held-state').textContent = scene.hasAttribute('data-cv-stuck')
      ? 'held'
      : 'free';
    const video = document.getElementById('media')?.video;
    if (stage.paused && video && !video.paused) {
      state.resumeVideo = true;
      video.pause();
    } else if (!stage.paused && active && state.resumeVideo && video) {
      state.resumeVideo = false;
      void video.play().catch(() => {});
    }
  }
  on(controls.querySelector('#case-pause'), 'click', () =>
    stage.paused ? stage.play() : stage.pause()
  );
  on(motion, 'change', syncOwn);
  on(scene.querySelector('#media'), 'play', syncOwn);
  const remount = (changes) =>
    mountIntegratedCase({ ...{ context, layout, language }, ...changes });
  on(
    controls.querySelector('#case-context'),
    'change',
    (e) => void remount({ context: e.target.value })
  );
  on(
    controls.querySelector('#case-layout'),
    'change',
    (e) =>
      void remount({
        layout: e.target.value,
        context: e.target.value === 'track' && context.startsWith('enter') ? 'zone-auto' : context,
      })
  );
  on(
    controls.querySelector('#case-language'),
    'click',
    () => void remount({ language: language === 'en' ? 'zh-CN' : 'en' })
  );
  on(controls.querySelector('#case-replay'), 'click', () => {
    stage.goTo(0, { animated: false });
    requestAnimationFrame(() => stage.goTo(1));
  });
  on(scene.querySelector('#save-example'), 'click', () => {
    state.saved = true;
    document.getElementById('state-note').textContent = copy.save;
  });
  const slider = scene.querySelector('#comparison');
  const compare = () => {
    scene.querySelector('.compare-after').style.clipPath =
      `inset(0 ${100 - Number(slider.value)}% 0 0)`;
    scene.querySelector('.compare-line').style.left = `${slider.value}%`;
  };
  on(slider, 'input', compare);
  compare();
  const gallery = scene.querySelector('#snap-gallery');
  const syncGallery = () => {
    const k = Math.round(gallery.scrollLeft / gallery.clientWidth);
    scene.querySelector('#gallery-prev').disabled = k === 0;
    scene.querySelector('#gallery-next').disabled = k === 2;
  };
  on(gallery, 'scroll', syncGallery);
  on(scene.querySelector('#gallery-prev'), 'click', () =>
    gallery.scrollBy({ left: -gallery.clientWidth, behavior: 'instant' })
  );
  on(scene.querySelector('#gallery-next'), 'click', () =>
    gallery.scrollBy({ left: gallery.clientWidth, behavior: 'instant' })
  );
  const kinetic = scene.querySelector('#kinetic-gallery');
  let press = null;
  const inertia = () => {
    state.localVelocity *= 0.9;
    kinetic.scrollLeft += state.localVelocity;
    if (Math.abs(state.localVelocity) > 0.15 && !state.disposed && !stage.paused)
      state.localRaf = requestAnimationFrame(inertia);
    else state.localRaf = 0;
  };
  on(kinetic, 'pointerdown', (e) => {
    cancelAnimationFrame(state.localRaf);
    state.localRaf = 0;
    press = { id: e.pointerId, x: e.clientX, at: e.timeStamp };
    state.localVelocity = 0;
    kinetic.setPointerCapture(e.pointerId);
  });
  on(kinetic, 'pointermove', (e) => {
    if (!press || press.id !== e.pointerId) return;
    const dx = press.x - e.clientX;
    state.localVelocity = (dx / Math.max(1, e.timeStamp - press.at)) * 16;
    kinetic.scrollLeft += dx;
    press = { id: e.pointerId, x: e.clientX, at: e.timeStamp };
    e.preventDefault();
  });
  on(kinetic, 'pointerup', () => {
    press = null;
    state.localRaf = requestAnimationFrame(inertia);
  });
  on(kinetic, 'pointercancel', () => {
    press = null;
    state.localVelocity = 0;
  });
  const image = scene.querySelector('#pending-image');
  on(image, 'load', () => (document.getElementById('image-status').textContent = copy.loaded));
  on(
    image,
    'error',
    () => (document.getElementById('image-status').textContent = material.text.unavailable)
  );
  // Only this subscription owns the custom SVG; it never writes framework layer output.
  unsubscribers.push(
    scene.querySelector('#F').timeline.subscribe((frame) => {
      state.subscribedFrames++;
      const p =
        frame.phase === 'exiting'
          ? 1 - frame.progress
          : frame.phase === 'exited'
            ? 0
            : frame.progress;
      scene.querySelector('#drawing-fill').setAttribute('d', `M1 24H${1 + 58 * p}`);
    })
  );
  state.dispose = () => {
    if (state.disposed) return;
    state.disposed = true;
    abort.abort();
    for (const stop of unsubscribers) stop();
    for (const a of own) a.cancel();
    cancelAnimationFrame(state.localRaf);
    state.localRaf = 0;
    state.resumeVideo = false;
    bench.unmount();
    controls.replaceChildren();
  };
  await pending;
  if (state.disposed) return;
  state.readyClock = stage.clock.now();
  if (image.complete && image.naturalWidth)
    document.getElementById('image-status').textContent = copy.loaded;
  const canvas = scene.querySelector('#dither'),
    ctx = canvas.getContext('2d'),
    pixels = ctx.createImageData(canvas.width, canvas.height);
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
      const v = x / canvas.width > (matrix[y % 8][x % 8] + 0.5) / 64 ? 255 : 0;
      pixels.data.set([v, v, v, 255], (y * canvas.width + x) * 4);
    }
  ctx.putImageData(pixels, 0, 0);
  state.ditherBlack = [...pixels.data].filter((v, i) => i % 4 === 0 && v === 0).length;
  for (const [i, img] of [...scene.querySelectorAll('[data-pan]')].entries()) {
    const a = img.animate(
      [
        {
          offset: 0,
          transform: 'translate(-2%,0) scale(1.06)',
          transformOrigin: '25% 40%',
          opacity: i ? 0 : 1,
        },
        { offset: 0.42, opacity: i ? 0 : 1 },
        { offset: 0.58, opacity: i ? 1 : 0 },
        {
          offset: 1,
          transform: 'translate(2%,-1%) scale(1.12)',
          transformOrigin: '65% 50%',
          opacity: i ? 1 : 0,
        },
      ],
      { duration: 12000, iterations: Infinity, direction: 'alternate', easing: 'linear' }
    );
    a.pause();
    own.push(a);
  }
  const band = scene.querySelector('#marquee'),
    width = band.firstElementChild.getBoundingClientRect().width;
  const marquee = band.animate([{ translate: '0 0' }, { translate: `-${width}px 0` }], {
    duration: Math.max(1000, (width / 24) * 1000),
    iterations: Infinity,
    easing: 'linear',
  });
  marquee.pause();
  own.push(marquee);
  syncOwn();
  window.integratedReady = true;
  return readIntegratedCase();
}

export function readIntegratedCase() {
  const s = current;
  if (!s) return null;
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
  };
  return {
    context: s.context,
    layout: s.layout,
    language: s.language,
    disposed: s.disposed,
    current: s.stage.current,
    clock: s.stage.clock.now(),
    paused: s.stage.paused,
    scrollY,
    viewport: { width: innerWidth, height: innerHeight },
    total: s.scene.solution.total,
    travel: s.scene.travel,
    docTop: s.scene.docTop,
    scene: rect(s.scene),
    sheet: rect(s.scene.querySelector('.case-sheet')),
    footer: rect(s.scene.querySelector('.case-footer')),
    fixed: (() => {
      const host = s.scene.querySelector('#fixed-state');
      return {
        host: rect(host),
        layer: rect(host.shadowRoot.querySelector('[part=layer]')),
        shell: rect(s.scene.shell),
        label: rect(host.querySelector('.case-fixed-status')),
      };
    })(),
    theme: s.stage.getAttribute('data-cv-theme'),
    direction: s.stage.getAttribute('data-cv-direction'),
    stuck: s.scene.hasAttribute('data-cv-stuck'),
    covered: s.scene.covered,
    trackTranslate: s.scene.track.style.translate,
    saved: s.saved,
    errors: s.errors,
    events: s.events,
    inputs: s.inputs,
    subscribedFrames: s.subscribedFrames,
    readyClock: s.readyClock,
    own: s.own.map((a) => ({ state: a.playState, time: a.currentTime })),
    localRaf: s.localRaf,
    ditherBlack: s.ditherBlack,
    modules: [...s.scene.querySelectorAll('[data-module]')].map((el) => ({
      id: el.dataset.module,
      ...rect(el),
    })),
    nodes: s.scene.ordered.map((a) => ({
      id: a.id,
      timed: a.timed,
      clocked: a.clocked,
      solved: a.solved,
      clockSolved: a.clockSolved,
      phase: a.getAttribute('data-cv-phase'),
      frame: a.timeline.frame,
      splitCount: a.split?.pieces.length ?? 0,
      splitText: a.split?.pieces.map((p) => p.textContent) ?? [],
      looping: a.looping,
      periods: a.loopItems.map((l) => l.duration),
      layers: a.layers.map((l) => {
        const c = getComputedStyle(l.el);
        return {
          source: l.source,
          kind: l.kind,
          native: !!l.native,
          opacity: c.opacity,
          translate: c.translate,
          rotate: c.rotate,
          scale: c.scale,
          clip: c.clipPath,
          filter: c.filter,
          vars: Object.fromEntries([...l.vars].map((v) => [v, c.getPropertyValue(v)])),
          font: c.fontVariationSettings,
          piece: l.piece,
          item: l.item,
          bounds: rect(l.el),
          text: l.el.textContent,
        };
      }),
    })),
    images: [...s.scene.querySelectorAll('img')].map((img) => ({
      id: img.id,
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      ...rect(img),
    })),
    imageCopies: (() => {
      const host = s.scene.querySelector('#develop');
      const img = host.querySelector('img');
      return ['develop', 'duotone'].map((part) => {
        const container = host.shadowRoot.querySelector(`[part=${part}]`);
        return {
          part,
          container: container ? rect(container) : null,
          opacity: container ? Number(getComputedStyle(container).opacity) : null,
          items: [...(container?.children ?? [])].map((box) => {
            const copy = box.lastElementChild;
            const before = rect(img),
              copyRect = rect(copy),
              after = rect(img);
            const b = getComputedStyle(box),
              c = getComputedStyle(copy);
            return {
              before,
              box: rect(box),
              copy: copyRect,
              after,
              mask: b.maskImage,
              mode: b.maskMode,
              dark: b.backgroundColor,
              inkMask: c.maskImage,
              inkMode: c.maskMode,
              light: c.backgroundColor,
            };
          }),
        };
      });
    })(),
    video: (() => {
      const v = s.scene.querySelector('#media').video;
      return v
        ? {
            time: v.currentTime,
            duration: v.duration,
            ready: v.readyState,
            paused: v.paused,
            seeking: v.seeking,
            error: v.error?.message ?? null,
            ...rect(v),
          }
        : null;
    })(),
    compare: {
      value: s.scene.querySelector('#comparison').value,
      clip: s.scene.querySelector('.compare-after').style.clipPath,
      frame: rect(s.scene.querySelector('#material-subject')),
      before: rect(s.scene.querySelector('#material-subject img')),
      copy: rect(s.scene.querySelector('.compare-after')),
      after: rect(s.scene.querySelector('#material-subject img')),
    },
    gallery: {
      left: s.scene.querySelector('#snap-gallery').scrollLeft,
      width: s.scene.querySelector('#snap-gallery').clientWidth,
      kinetic: s.scene.querySelector('#kinetic-gallery').scrollLeft,
    },
    supported: {
      viewTimeline: typeof ViewTimeline !== 'undefined',
      scrollTimeline: typeof ScrollTimeline !== 'undefined',
      markers: CSS.supports('selector(::scroll-marker)'),
    },
  };
}
window.integrated = {
  mount: mountIntegratedCase,
  read: readIntegratedCase,
  dispose: () => current?.dispose(),
  goTo: (target, animated = false) => current.stage.goTo(target, { animated }),
  get state() {
    return current;
  },
};
const query = new URLSearchParams(location.search);
await mountIntegratedCase({
  context: query.get('context') || 'zone-fallback',
  layout: query.get('layout') || 'grid',
  language: query.get('language') || 'en',
});
