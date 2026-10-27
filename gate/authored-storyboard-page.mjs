const copy = {
  en: {
    heading: 'From material to an explanation',
    intro: 'An illustrative three-step workflow using one source document.',
    source: 'Field notes',
    imageHeading: 'Source document',
    titles: ['Collect material', 'Highlight details', 'Produce an explanation'],
    descriptions: [
      'Keep the source list beside the document you are reading.',
      'Mark the passage you want to explain and keep its source visible.',
      'Review the example explanation beside the material it describes.',
    ],
    summary: 'Collect material, highlight details, then review the explanation.',
    action: 'Get started',
    unavailable: 'Illustration unavailable; the wireframe and description remain available.',
    field: 'Name this example',
    save: 'Save example',
    saved: 'Saved example:',
    close: 'Close',
  },
  'zh-CN': {
    heading: '从资料到说明',
    intro: '使用同一份来源文档展示三个步骤，内容仅供示例。',
    source: '现场笔记',
    imageHeading: '来源文档',
    titles: ['收集资料', '标记重点', '生成说明'],
    descriptions: [
      '把来源列表放在正在阅读的文档旁边。',
      '标出需要说明的段落，并保留对应来源。',
      '在原始资料旁查看示例说明。',
    ],
    summary: '收集资料、标记重点，再查看对应说明。',
    action: '开始使用',
    unavailable: '示意图暂不可用，线框和步骤说明仍可查看。',
    field: '为这个示例命名',
    save: '保存示例',
    saved: '已保存示例：',
    close: '关闭',
  },
};

/** Fixed illustrative material, not a Cineview product or a reusable effect preset. */
export function r2Material(language = 'en') {
  const text = copy[language];
  if (!text) throw new Error(`Unknown R2 language ${language}`);
  const colors = ['#b84a30', '#2e745a', '#315fa4'];
  const assets = Object.fromEntries(
    ['A', 'B', 'C'].map((key, i) => [
      key,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" width="640" height="400" aria-hidden="true">
      <rect width="640" height="400" fill="#fbf4e6"/>
      <rect data-landmark="document" x="80" y="40" width="480" height="320" rx="8" fill="#ffffff" stroke="#24342e" stroke-width="2"/>
      <rect data-landmark="state" x="100" y="80" width="48" height="48" fill="${colors[i]}"/>
      <text data-landmark="heading" x="160" y="100" fill="#24342e" font-family="system-ui,sans-serif" font-size="22">${text.imageHeading}</text>
      <text data-landmark="source" x="100" y="158" fill="#24342e" font-family="system-ui,sans-serif" font-size="18">${text.source}</text>
      <path d="M100 190H520 M100 220H480 M100 250H500 M100 280H420" fill="none" stroke="#6b7971" stroke-width="5"/>
      ${i > 0 ? '<rect x="94" y="207" width="398" height="24" fill="#f0cf74" fill-opacity=".7"/>' : ''}
      ${i === 2 ? '<rect x="330" y="246" width="200" height="90" rx="4" fill="#e4edf8" stroke="#315fa4" stroke-width="2"/><path d="M346 266H510 M346 286H490 M346 306H500" stroke="#315fa4" stroke-width="4"/>' : ''}
    </svg>`,
    ])
  );
  return { text, assets };
}

/** Mount the public-guide R2 example through the already served fixture's public DOM. */
export async function mountR2Story(
  page,
  {
    context = 'zone-fallback',
    language = 'en',
    presentation = 'enhanced',
    instance = 'r2',
    opening = null,
  } = {}
) {
  const material = r2Material(language);
  return page.evaluate(
    async (options) => {
      window.r2Story?.dispose();
      const pending = bench.mount({ ids: [], context: options.context, exits: false });
      const stage = document.querySelector('cv-stage');
      if (options.opening) stage.pause();
      const scene = document.querySelector('#middle');
      const root = stage.parentElement;
      const text = options.material.text;
      const keys = ['A', 'B', 'C'];
      const previousLanguage = document.documentElement.lang;
      document.documentElement.lang = options.language;
      scene.removeAttribute('zone');
      const content = document.createElement('section');
      content.className = 'r2-content';
      content.innerHTML = `<h2>${text.heading}</h2><p>${text.intro}</p>
      <ol class="r2-list">${keys
        .map(
          (key, i) => `<li data-r2-step="${key}">
        <div class="r2-copy"><h3 id="r2-step-${key}"><span class="r2-emphasis" aria-hidden="true">●</span> ${key}. ${text.titles[i]}</h3><p>${text.descriptions[i]}</p></div>
        <figure aria-labelledby="r2-step-${key}" data-r2-figure="${key}"><div class="r2-canvas" aria-hidden="true">
          ${options.material.assets[key]}<img width="640" height="400" alt="" src="/authored-r2-${options.language}-${key}.svg?run=${encodeURIComponent(options.instance)}"/>
        </div><figcaption class="r2-image-status" hidden>${text.unavailable}</figcaption></figure>
      </li>`
        )
        .join(
          ''
        )}</ol><button type="button" data-r2-open aria-haspopup="dialog">${text.action}</button>`;
      scene.replaceChildren(content);
      for (const id of ['before', 'after']) {
        document.getElementById(id).innerHTML =
          `<section class="r2-bookend"><h${id === 'before' ? 1 : 2}>${id === 'before' ? text.heading : text.summary}</h${id === 'before' ? 1 : 2}><p>${text.intro}</p><button type="button" data-r2-open aria-haspopup="dialog">${text.action}</button></section>`;
      }
      if (options.opening) {
        document.getElementById('before').innerHTML = options.opening.html;
        document.getElementById('r1-action').setAttribute('data-r2-open', '');
        document.getElementById('r1-action').setAttribute('aria-haspopup', 'dialog');
      }
      const style = document.createElement('style');
      style.id = 'r2-page-style';
      style.textContent = `
      .r2-content,.r2-bookend{color:#24342e;background:#fbf4e6;padding:32px;font:17px/1.5 system-ui,sans-serif}
      .r2-content{max-width:1180px;margin:0 auto}.r2-content h2{font-size:32px;line-height:1.15;margin:0 0 12px}
      .r2-content h3{font-size:20px;margin:0 0 8px}.r2-content p{margin:0 0 16px}
      .r2-list{list-style:none;padding:0;margin:24px 0}.r2-list>li{margin:0 0 28px}
      .r2-copy{padding:12px 16px;border-left:3px solid transparent}.r2-copy p{opacity:1}
      .r2-list [aria-current="step"] .r2-copy{border-color:#24342e}.r2-emphasis{color:#24342e}
      .r2-list figure{margin:0}.r2-canvas{position:relative;width:100%;aspect-ratio:8/5;background:#fbf4e6}
      .r2-canvas>svg,.r2-canvas>img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:contain;object-position:center}
      .r2-canvas>img{visibility:hidden}.r2-image-status{font-size:14px;line-height:1.4;background:#fbf4e6;color:#24342e}
      #middle.r2-static{height:auto!important;min-height:0}.r2-static .r2-content{max-width:720px}
      .r2-static .r2-emphasis{display:none}.r2-enhanced .r2-list{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);grid-template-rows:repeat(3,140px);gap:0 32px}
      .r2-enhanced .r2-list>li{display:contents}.r2-enhanced .r2-copy{grid-column:1}
      .r2-enhanced li:nth-child(1) .r2-copy{grid-row:1}.r2-enhanced li:nth-child(2) .r2-copy{grid-row:2}.r2-enhanced li:nth-child(3) .r2-copy{grid-row:3}
      .r2-enhanced figure{grid-column:2;grid-row:1/4;align-self:center;min-width:0;position:relative}
      .r2-enhanced .r2-image-status{position:absolute;top:100%;left:0;right:0}
      .r2-enhanced li:nth-child(1) figure{z-index:0}.r2-enhanced li:nth-child(2) figure{z-index:1}.r2-enhanced li:nth-child(3) figure{z-index:2}
      .r2-bookend{min-height:100svh;display:flex;flex-direction:column;justify-content:center;align-items:flex-start}
      .r2-content button,.r2-bookend button,#r2-dialog button{font:inherit;min-height:44px;padding:8px 20px;border:1px solid #24342e;border-radius:4px;background:#24342e;color:#fbf4e6}
      .r2-content button:focus-visible,.r2-bookend button:focus-visible,#r2-dialog :focus-visible{outline:3px solid #b84a30;outline-offset:4px}
      #r2-dialog{padding:24px;max-width:min(480px,90vw);color:#24342e;background:#fbf4e6;border:2px solid #24342e}
      #r2-dialog::backdrop{background:rgb(0 0 0/.35)}#r2-dialog input{display:block;width:100%;font:inherit;min-height:44px;margin:8px 0 16px}
      #r2-dialog output{display:block;margin:16px 0}#r2-source{display:block}
    `;
      if (options.opening)
        style.textContent +=
          options.opening.css +
          '.r1-opening button:focus-visible{outline:3px solid #b84a30;outline-offset:4px}';
      const dialog = document.createElement('dialog');
      dialog.id = 'r2-dialog';
      dialog.setAttribute('aria-labelledby', 'r2-dialog-heading');
      dialog.innerHTML = `<h2 id="r2-dialog-heading">${text.action}</h2><form><label for="r2-name">${text.field}</label><input id="r2-name" name="example" required/><button type="submit">${text.save}</button><output aria-live="polite"></output></form><button type="button" data-r2-close>${text.close}</button>`;
      root.append(style, dialog);
      const abort = new AbortController();
      const signal = abort.signal;
      const motion = matchMedia('(prefers-reduced-motion: reduce)');
      const layout = matchMedia('(min-width:900px) and (min-height:700px)');
      const items = keys.map((key) => {
        const step = content.querySelector(`[data-r2-step="${key}"]`);
        return {
          key,
          step,
          figure: step.querySelector('figure'),
          emphasis: step.querySelector('.r2-emphasis'),
          image: step.querySelector('img'),
          status: step.querySelector('figcaption'),
        };
      });
      let alive = true,
        unsubscribe = () => {},
        source = null,
        trigger = null;
      const state = {
        context: options.context,
        language: options.language,
        presentation: options.presentation,
        mode: 'static',
        initialized: false,
        updates: 0,
        assetWrites: 0,
        disposed: false,
        source: null,
        content,
        items,
      };
      const render = (frame) => {
        if (!alive || state.mode !== 'enhanced') return;
        const p = Math.min(1, Math.max(0, frame.progress));
        const rise = (start, end) => Math.min(1, Math.max(0, (p - start) / (end - start)));
        const alpha = [
          1 - rise(0.35, 0.4),
          rise(0.3, 0.35) * (1 - rise(0.7, 0.75)),
          rise(0.65, 0.7),
        ];
        const weights = [
          alpha[0] * (1 - alpha[1]) * (1 - alpha[2]),
          alpha[1] * (1 - alpha[2]),
          alpha[2],
        ];
        const current = p < 0.35 ? 0 : p < 0.7 ? 1 : 2;
        items.forEach((item, i) => {
          item.figure.style.opacity = String(alpha[i]);
          item.emphasis.style.opacity = String(weights[i]);
          if (current === i) item.step.setAttribute('aria-current', 'step');
          else item.step.removeAttribute('aria-current');
        });
        state.updates++;
      };
      const configure = () => {
        if (!alive) return;
        unsubscribe();
        unsubscribe = () => {};
        if (source) source.replaceWith(content);
        source = null;
        state.source = null;
        const enhanced = options.presentation !== 'default' && !motion.matches && layout.matches;
        state.mode = enhanced ? 'enhanced' : 'static';
        scene.classList.toggle('r2-enhanced', enhanced);
        scene.classList.toggle('r2-static', !enhanced);
        scene.toggleAttribute('zone', enhanced);
        items.forEach((item) => {
          item.figure.style.removeProperty('opacity');
          item.emphasis.style.removeProperty('opacity');
          item.step.removeAttribute('aria-current');
        });
        if (enhanced) {
          source = document.createElement('cv-animate');
          source.id = 'r2-source';
          source.setAttribute('on', 'scene');
          source.setAttribute('duration', '4000');
          source.setAttribute('ease', 'linear');
          source.setAttribute('from', '--r2-source:0');
          source.setAttribute('to', '--r2-source:1');
          content.replaceWith(source);
          source.append(content);
          state.source = source;
          unsubscribe = source.timeline.subscribe(render);
          render(source.timeline.frame);
        }
        if (state.initialized) stage.refresh();
      };
      motion.addEventListener('change', configure, { signal });
      layout.addEventListener('change', configure, { signal });
      root.addEventListener(
        'click',
        (event) => {
          const button = event.target.closest('[data-r2-open]');
          if (!button) return;
          trigger = button;
          dialog.showModal();
          dialog.querySelector('input').focus({ preventScroll: true });
        },
        { signal }
      );
      dialog
        .querySelector('[data-r2-close]')
        .addEventListener('click', () => dialog.close(), { signal });
      dialog.addEventListener(
        'close',
        () => trigger?.isConnected && trigger.focus({ preventScroll: true }),
        { signal }
      );
      dialog.querySelector('form').addEventListener(
        'submit',
        (event) => {
          event.preventDefault();
          dialog.querySelector('output').textContent =
            `${text.saved} ${dialog.querySelector('input').value}`;
        },
        { signal }
      );
      for (const item of items) {
        const reveal = async () => {
          try {
            await item.image.decode();
            if (!alive || !item.image.naturalWidth) return;
            item.image.style.visibility = 'visible';
            item.status.hidden = true;
            state.assetWrites++;
          } catch {
            if (alive) item.status.hidden = false;
          }
        };
        item.image.addEventListener('load', reveal, { signal });
        item.image.addEventListener(
          'error',
          () => {
            if (alive) item.status.hidden = false;
          },
          { signal }
        );
        if (item.image.complete) void reveal();
      }
      state.dispose = () => {
        if (!alive) return;
        alive = false;
        state.disposed = true;
        unsubscribe();
        abort.abort();
        dialog.close();
        dialog.remove();
        style.remove();
        document.documentElement.lang = previousLanguage;
      };
      window.r2Story = state;
      configure();
      await stage.ready;
      if (alive) {
        state.initialized = true;
        if (source) render(source.timeline.frame);
      }
      await pending;
      return { initialized: state.initialized, mode: state.mode, language: state.language };
    },
    { context, language, presentation, instance, material, opening }
  );
}

/** Capture public output/geometry; internal fixture fields are explicitly diagnostic. */
export function readR2Story(page) {
  return page.evaluate(() => {
    const state = window.r2Story;
    const scene = document.querySelector('#middle');
    const stage = document.querySelector('cv-stage');
    const rect = (node) => node.getBoundingClientRect().toJSON();
    return {
      mode: state.mode,
      initialized: state.initialized,
      disposed: state.disposed,
      language: document.documentElement.lang,
      updates: state.updates,
      assetWrites: state.assetWrites,
      scrollY,
      viewport: { width: innerWidth, height: innerHeight },
      documentHeight: document.documentElement.scrollHeight,
      scene: rect(scene),
      content: rect(state.content),
      zone: scene.hasAttribute('zone'),
      frame: state.source ? { ...state.source.timeline.frame } : null,
      action: rect(state.content.querySelector('[data-r2-open]')),
      items: state.items.map((item) => ({
        key: item.key,
        current: item.step.getAttribute('aria-current'),
        title: item.step.querySelector('h3').textContent.trim(),
        imageHeading: item.step.querySelector('svg [data-landmark="heading"]').textContent,
        description: item.step.querySelector('.r2-copy p').textContent,
        opacity: +getComputedStyle(item.figure).opacity,
        emphasis: +getComputedStyle(item.emphasis).opacity,
        bodyOpacity: +getComputedStyle(item.step.querySelector('.r2-copy p')).opacity,
        figure: rect(item.figure),
        canvas: rect(item.step.querySelector('.r2-canvas')),
        copy: rect(item.step.querySelector('.r2-copy')),
        image: {
          src: item.image.currentSrc || item.image.src,
          complete: item.image.complete,
          width: item.image.naturalWidth,
          height: item.image.naturalHeight,
          visibility: getComputedStyle(item.image).visibility,
          opacity: +getComputedStyle(item.image).opacity,
          fit: getComputedStyle(item.image).objectFit,
        },
        failureVisible: !item.status.hidden,
        landmarks: [...item.step.querySelectorAll('svg [data-landmark]')].map((el) => ({
          name: el.dataset.landmark,
          bounds: rect(el),
        })),
      })),
      diagnostic: {
        fixture: bench.snapshot(),
        current: stage.current,
        total: scene.solution?.total,
        native:
          state.source?.layers?.map((l) => ({ source: l.source, attached: !!l.native })) ?? [],
      },
      errors: window.r2ObservedErrors ?? [],
    };
  });
}

export async function disposeR2Story(page) {
  return page.evaluate(() => {
    window.r2Story?.dispose();
    bench.unmount();
    return {
      ...bench.snapshot(),
      pageStyle: !!document.getElementById('r2-page-style'),
      dialog: !!document.getElementById('r2-dialog'),
      disposed: window.r2Story?.disposed,
    };
  });
}
