import { parseFromTo, parseFx, type Effect, type Source } from '../core/fx';
import { planLayers } from '../render/layers';
import {
  copyContainer,
  Develop,
  Duotone,
  FocusCopy,
  planFades,
  planInks,
  splitBlur,
} from './stills';

const fx = (text: string): Effect[] => parseFx(text, () => undefined);
const plans = (source: Source, text: string) =>
  planLayers(new Map([[source, { effects: fx(text), exits: [] }]]), 'scene');

/** An element holding `html`, laid out at w × h (jsdom has no layout). */
function host(html: string, w = 800, h = 600): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  Object.defineProperty(el, 'offsetWidth', { value: w });
  Object.defineProperty(el, 'offsetHeight', { value: h });
  return el;
}

describe('blur on large pictures (F12)', () => {
  it('splits blur off an effect, keeping its range and curve', () => {
    const [focus] = fx('focus 20% 80%');
    const [rest, blur] = splitBlur(focus!);
    expect(rest!.tracks).toEqual({ opacity: [0.34, 1] });
    expect(rest!.entries.map(([p]) => p)).toEqual(['opacity']);
    expect(blur!.tracks).toEqual({ blur: [4.5, 0] });
    expect([rest!.range, blur!.range, blur!.ease]).toEqual([[0.2, 0.8], [0.2, 0.8], focus!.ease]);
    // Blur alone leaves nothing behind; no blur leaves the effect as it is.
    expect(splitBlur(fx('blur-in')[0]!)[0]!.tracks).toEqual({ opacity: [0, 1] });
    expect(splitBlur(parseFromTo('blur:8px', null, null, () => undefined)!)[0]).toBeNull();
    const [fade] = fx('fade');
    expect(splitBlur(fade!)).toEqual([fade, null]);
  });

  it('moves the blur of a large picture to a fade plan; the layer keeps the rest', () => {
    const layers = plans('view', 'focus(band), drift');
    const fades = planFades(layers, host('<img src="a.png">'));
    expect(fades).toHaveLength(1);
    expect(fades[0]!.blur).toBe(4.5);
    expect(fades[0]!.layer.effects.map((e) => Object.keys(e.tracks))).toEqual([['blur'], ['blur']]);
    expect(layers[0]!.effects.flatMap((e) => Object.keys(e.tracks))).toEqual([
      'opacity',
      'opacity',
      'yp',
    ]);
  });

  it('leaves text, other media, small pictures and blur-free layers alone', () => {
    const cases: Array<[string, HTMLElement]> = [
      ['focus', host('<img src="a.png"><p>Caption</p>')],
      ['focus', host('<img src="a.png"><svg></svg>')],
      ['focus', host('<img src="a.png">', 300, 200)],
      ['focus', host('<p>No picture</p>')],
      ['fade', host('<img src="a.png">')],
    ];
    for (const [text, el] of cases) {
      const layers = plans('enter', text);
      expect(planFades(layers, el)).toEqual([]);
      expect(layers).toEqual(plans('enter', text));
    }
  });
});

describe('duotone prints (lexicon #27)', () => {
  it('moves duotone effects to an ink plan with their inks; the layer keeps the rest', () => {
    const layers = plans('enter', 'duotone(mono), rise');
    const inks = planInks(layers);
    expect(inks).toHaveLength(1);
    expect(inks[0]!.inks).toEqual(['#000', '#fff']);
    expect(inks[0]!.layer.effects.map((e) => e.tracks)).toEqual([{ opacity: [0, 1] }]);
    expect(layers[0]!.effects.map((e) => e.inks)).toEqual([null]);
    expect(layers[0]!.effects[0]!.tracks).toEqual({ opacity: [0, 1], y: [40, 0] });
    const plain = plans('enter', 'fade');
    expect(planInks(plain)).toEqual([]);
    expect(plain).toEqual(plans('enter', 'fade'));
  });
});

describe('image copy lifecycle', () => {
  const copies: Array<Develop | Duotone | FocusCopy> = [];
  const animations: Array<{ finish(): void; cancel: jest.Mock }> = [];
  const observers: Array<{ callback: () => void; disconnect: jest.Mock; unobserve: jest.Mock }> =
    [];
  const flush = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  };
  function imageState(
    img: HTMLImageElement,
    values: Partial<{
      complete: boolean;
      naturalWidth: number;
      naturalHeight: number;
      currentSrc: string;
    }>
  ) {
    for (const [key, value] of Object.entries(values))
      Object.defineProperty(img, key, { configurable: true, value });
  }
  function picture(html = '<img src="photo.png">') {
    const el = document.createElement('div');
    el.innerHTML = html;
    document.body.append(el);
    const root = el.attachShadow({ mode: 'open' }),
      slot = document.createElement('slot');
    root.append(slot);
    const container = copyContainer(slot, 'copy');
    container.style.width = '200px';
    container.style.height = '100px';
    container.getBoundingClientRect = () => new DOMRect(10, 20, 400, 200);
    const img = el.querySelector('img')!;
    img.style.cssText =
      'border:2px solid;padding:4px;object-fit:cover;object-position:25% 75%;border-radius:20px';
    img.getBoundingClientRect = () => new DOMRect(50, 60, 200, 120);
    return { el, img, container };
  }
  beforeEach(() => {
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: class {
        disconnect = jest.fn();
        unobserve = jest.fn();
        observe = jest.fn();
        constructor(readonly callback: () => void) {
          observers.push(this);
        }
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: jest.fn(() => {
        let finish!: () => void;
        const finished = new Promise<void>((resolve) => {
          finish = resolve;
        });
        const a = { finished, finish, cancel: jest.fn() };
        animations.push(a);
        return a;
      }),
    });
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      configurable: true,
      writable: true,
      value: jest.fn().mockResolvedValue(undefined),
    });
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    for (const copy of copies.splice(0)) copy.destroy();
    document.body.replaceChildren();
    animations.length = 0;
    observers.length = 0;
    jest.restoreAllMocks();
  });

  it('fits a blur copy to the content box under scale and follows a new selected image', () => {
    const { el, img, container } = picture(
      '<img src="photo.png" srcset="photo-2x.png 2x" sizes="100vw" crossorigin="anonymous">'
    );
    const focus = new FocusCopy(el, container);
    copies.push(focus);
    focus.mount(10);
    expect(container.getAttribute('aria-hidden')).toBe('true');
    const [filler, copy] = [...container.querySelectorAll('img')];
    expect(copy!.srcset).toBe('photo-2x.png 2x');
    expect(copy!.sizes).toBe('100vw');
    expect(copy!.crossOrigin).toBe('anonymous');
    const box = copy!.parentElement!;
    expect([box.style.left, box.style.top, box.style.width, box.style.height]).toEqual([
      '26px',
      '26px',
      '88px',
      '48px',
    ]);
    expect(copy!.style.objectFit).toBe('cover');
    expect(copy!.style.objectPosition).toBe('25% 75%');
    expect(box.style.borderRadius).toBe('20px');
    expect(Number(filler!.style.transform.match(/scale\((.+)\)/)![1])).toBeCloseTo(1.83333);
    imageState(img, { currentSrc: 'http://localhost/new.png' });
    img.dispatchEvent(new Event('load'));
    expect([copy!.src, filler!.src]).toEqual([
      'http://localhost/new.png',
      'http://localhost/new.png',
    ]);
    expect(copy!.hasAttribute('srcset')).toBe(false);
    focus.destroy();
    imageState(img, { currentSrc: 'http://localhost/stale.png' });
    img.dispatchEvent(new Event('load'));
    expect(copy!.src).toBe('http://localhost/new.png');
    expect(observers[0]!.disconnect).toHaveBeenCalled();
  });

  it('waits for a picture candidate, keeps author blurred variants and handles zero-size containers', () => {
    const { el, img, container } = picture('<picture><source srcset="large.png"><img></picture>');
    container.style.width = '0px';
    container.style.height = '0px';
    const focus = new FocusCopy(el, container);
    copies.push(focus);
    focus.mount(6);
    expect(container.querySelector('img')).toBeNull();
    imageState(img, { currentSrc: 'http://localhost/large.png' });
    img.dispatchEvent(new Event('load'));
    expect(container.querySelectorAll('img')).toHaveLength(2);
    const custom = picture('<img src="sharp.png" data-cv-blurred="soft.png">');
    const variant = new FocusCopy(custom.el, custom.container);
    copies.push(variant);
    variant.mount(6);
    expect(custom.container.querySelectorAll('img')).toHaveLength(1);
    expect(custom.container.querySelector('img')!.src).toContain('soft.png');
    imageState(custom.img, { currentSrc: 'http://localhost/new.png' });
    custom.img.dispatchEvent(new Event('load'));
    expect(custom.container.querySelector('img')!.src).toContain('soft.png');
    custom.container.style.boxSizing = 'border-box';
    observers.at(-1)!.callback();
    expect(custom.container.firstElementChild!.getAttribute('style')).toContain('width: 88px');
  });

  it('does not invent an image source for empty image content', () => {
    const { el, container } = picture('<img>');
    const focus = new FocusCopy(el, container);
    copies.push(focus);
    focus.mount(4);
    expect(container.children).toHaveLength(0);
  });

  it('crossfades a supplied stand-in only after the original decodes, then drops the copy', async () => {
    const { el, img, container } = picture(
      '<img src="photo.png" data-cv-standin="placeholder.png">'
    );
    imageState(img, { complete: false });
    const develop = new Develop(el, container);
    copies.push(develop);
    develop.mount(300, 'ease-out');
    expect(container.querySelector('img')!.src).toContain('placeholder.png');
    expect(animations).toHaveLength(0);
    img.dispatchEvent(new Event('load'));
    await flush();
    expect(animations).toHaveLength(1);
    expect((HTMLElement.prototype.animate as jest.Mock).mock.calls[0]).toEqual([
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: 300, easing: 'ease-out', fill: 'forwards' },
    ]);
    animations[0]!.finish();
    await flush();
    expect(container.children).toHaveLength(0);
    expect(observers[0]!.unobserve).toHaveBeenCalledWith(img);
  });

  it('waits for both original and stand-in when the source is copied, and cancels a running fade on destroy', async () => {
    const { el, img, container } = picture();
    imageState(img, { complete: false });
    const develop = new Develop(el, container);
    copies.push(develop);
    develop.mount(200, 'linear');
    const copy = container.querySelector('img')!;
    imageState(copy, { complete: false });
    img.dispatchEvent(new Event('load'));
    await flush();
    expect(animations).toHaveLength(0);
    copy.dispatchEvent(new Event('load'));
    await flush();
    expect(animations).toHaveLength(1);
    develop.destroy();
    expect(animations[0]!.cancel).toHaveBeenCalledTimes(1);
    animations[0]!.finish();
    await flush();
    expect(container.isConnected).toBe(false);
  });

  it.each([true, false])(
    'settles broken originals, retaining only authored stand-ins (variant %s)',
    async (variant) => {
      const { el, img, container } = picture(
        `<img src="broken.png"${variant ? ' data-cv-standin="placeholder.png"' : ''}>`
      );
      imageState(img, { complete: false });
      img.decode = () => Promise.reject(new Error('broken'));
      const develop = new Develop(el, container);
      copies.push(develop);
      develop.mount(200, 'linear');
      const copy = container.querySelector('img')!;
      imageState(copy, { complete: true });
      copy.dispatchEvent(new Event('error'));
      img.dispatchEvent(new Event('error'));
      await flush();
      expect(container.children).toHaveLength(variant ? 1 : 0);
      expect(animations).toHaveLength(0);
    }
  );

  it('does not revive a destroyed stand-in when pending loads settle; skips already complete images', async () => {
    const { el, img, container } = picture();
    imageState(img, { complete: false });
    const develop = new Develop(el, container);
    copies.push(develop);
    develop.mount(200, 'linear');
    const copy = container.querySelector('img')!;
    develop.destroy();
    img.dispatchEvent(new Event('load'));
    copy.dispatchEvent(new Event('load'));
    await flush();
    expect(animations).toHaveLength(0);
    expect(container.isConnected).toBe(false);
    const cached = picture();
    imageState(cached.img, { complete: true });
    const done = new Develop(cached.el, cached.container);
    copies.push(done);
    done.mount(200, 'linear');
    expect(cached.container.isConnected).toBe(false);
  });

  it('prints an arriving duotone source, follows load-time source changes, and removes listeners on destroy', () => {
    const { el, img, container } = picture();
    imageState(img, { currentSrc: '', naturalWidth: 0, naturalHeight: 0 });
    const print = new Duotone(el, container);
    copies.push(print);
    print.mount(['#123456', '#abcdef']);
    expect(container.children).toHaveLength(0);
    imageState(img, {
      currentSrc: 'http://localhost/photo.png',
      naturalWidth: 320,
      naturalHeight: 180,
    });
    img.dispatchEvent(new Event('load'));
    const box = container.firstElementChild as HTMLElement,
      ink = box.firstElementChild as HTMLElement;
    expect(box.style.background).toBe('rgb(18, 52, 86)');
    expect(ink.style.background).toBe('rgb(171, 205, 239)');
    expect(box.style.getPropertyValue('mask-image')).toContain('photo.png');
    expect(box.style.getPropertyValue('mask-size')).toBe('cover');
    imageState(img, { currentSrc: 'http://localhost/new.png' });
    img.style.objectFit = 'contain';
    img.dispatchEvent(new Event('load'));
    expect(container.children).toHaveLength(1);
    expect(ink.style.getPropertyValue('mask-image')).toContain('new.png');
    expect(ink.style.getPropertyValue('mask-size')).toBe('contain');
    print.destroy();
    imageState(img, { currentSrc: 'http://localhost/stale.png' });
    img.dispatchEvent(new Event('load'));
    expect(ink.style.getPropertyValue('mask-image')).toContain('new.png');
  });

  it.each([
    ['none', 20, 10, '20px 10px'],
    ['scale-down', 20, 10, '20px 10px'],
    ['scale-down', 400, 300, 'contain'],
    ['fill', 20, 10, '100% 100%'],
  ])(
    'sizes %s masks to the content box without distorting small natural images',
    (fit, w, h, expected) => {
      const { el, img, container } = picture();
      imageState(img, {
        currentSrc: 'http://localhost/photo.png',
        naturalWidth: w as number,
        naturalHeight: h as number,
      });
      img.style.objectFit = fit as string;
      const print = new Duotone(el, container);
      copies.push(print);
      print.mount(['black', 'white']);
      expect((container.firstElementChild as HTMLElement).style.getPropertyValue('mask-size')).toBe(
        expected
      );
    }
  );

  it.each([false, true])(
    'keeps foreign images visible unless CORS is declared (CORS %s)',
    (cors) => {
      const { el, img, container } = picture();
      imageState(img, { currentSrc: 'https://images.example/foreign.png', naturalWidth: 100 });
      if (cors) img.crossOrigin = 'anonymous';
      const print = new Duotone(el, container);
      copies.push(print);
      print.mount(['black', 'white']);
      expect(container.children).toHaveLength(cors ? 1 : 0);
      expect(console.warn).toHaveBeenCalledTimes(cors ? 0 : 1);
    }
  );
});

it.each([true, false])(
  'ends original and copy listeners before pending images settle (author stand-in %s)',
  async (variant) => {
    const el = document.createElement('div');
    el.innerHTML = `<img src="pending.png"${variant ? ' data-cv-standin="placeholder.png"' : ''}>`;
    const img = el.querySelector('img')!;
    Object.defineProperty(img, 'complete', { value: false });
    const root = el.attachShadow({ mode: 'open' }),
      slot = document.createElement('slot');
    root.append(slot);
    const add = jest.spyOn(HTMLImageElement.prototype, 'addEventListener');
    const remove = jest.spyOn(HTMLImageElement.prototype, 'removeEventListener');
    const animate = jest.fn(() => ({ finished: Promise.resolve(), cancel: jest.fn() }));
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: class {
        observe(): void {}
        disconnect(): void {}
      },
    });
    try {
      for (let visit = 0; visit < 3; visit++) {
        const container = copyContainer(slot, 'develop');
        const develop = new Develop(el, container);
        develop.mount(200, 'linear');
        const pending = add.mock.calls
          .map((args, i) => ({ args, owner: add.mock.contexts[i] }))
          .filter(({ args: [type] }) => type === 'load' || type === 'error');
        expect(pending).toHaveLength(variant ? 2 : 4);
        develop.destroy();
        for (const {
          args: [type, listener],
          owner,
        } of pending) {
          expect(
            remove.mock.calls.some(
              ([name, fn], i) =>
                name === type && fn === listener && remove.mock.contexts[i] === owner
            )
          ).toBe(true);
        }
        expect(container.parentNode).toBeNull();
        for (const target of new Set(pending.map((p) => p.owner)))
          target!.dispatchEvent(new Event('load'));
        for (let i = 0; i < 8; i++) await Promise.resolve();
        expect(animate).not.toHaveBeenCalled();
        add.mockClear();
        remove.mockClear();
      }
    } finally {
      jest.restoreAllMocks();
    }
  }
);
