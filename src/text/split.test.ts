import { TextSplit } from './split';

/** jsdom has no layout: what can be checked here is the shadow structure and the refusals. */
function host(html: string): { el: HTMLElement; slot: HTMLSlotElement; container: HTMLElement } {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.append(el);
  const root = el.attachShadow({ mode: 'open' });
  const container = document.createElement('div');
  const slot = document.createElement('slot');
  container.append(slot);
  root.append(container);
  return { el, slot, container };
}

describe('TextSplit', () => {
  afterEach(() => (document.body.textContent = ''));

  it('wraps the slot and adds a hidden-from-readers copy beside it', () => {
    const { el, slot, container } = host('Hello there');
    const split = new TextSplit(el, slot, 'words', null);
    const source = container.querySelector('[part=split-source]');
    const copy = container.querySelector('[part=split]');
    expect(source?.firstElementChild).toBe(slot);
    expect(copy?.getAttribute('aria-hidden')).toBe('true');
    expect(container.style.position).toBe('relative');
    split.destroy();
  });

  it('refuses content that is more than text', () => {
    const { el, slot } = host('Look <img alt="">');
    expect(new TextSplit(el, slot, 'words', null).mount()).toMatch(/more than text/);
  });

  it('refuses text with no box', () => {
    const { el, slot } = host('Hello');
    expect(new TextSplit(el, slot, 'lines', null).mount()).toMatch(/no text/);
  });

  it('shows the copy until a time source has entered, unless the end state moves the text', () => {
    const { el, slot, container } = host('Hello');
    const split = new TextSplit(el, slot, 'lines', null);
    const source = container.querySelector<HTMLElement>('[part=split-source]')!;
    split.show(true);
    expect(source.style.opacity).toBe('0');
    split.phase('entered');
    expect(source.style.opacity).toBe('');
    split.phase('entering');
    expect(source.style.opacity).toBe('0');
    split.atRest = false;
    split.phase('entered');
    expect(source.style.opacity).toBe('0');
    split.atRest = true;
    split.progress(0.99);
    expect(source.style.opacity).toBe('0');
    split.progress(1);
    expect(source.style.opacity).toBe('');
  });
});

describe('measured split lifecycle', () => {
  const splits: TextSplit[] = [];
  const observers: Array<{ callback: () => void; disconnect: jest.Mock }> = [];
  let rects = new Map<string, DOMRect[]>();
  const rectangle = (x: number, y: number, w = 40, h = 20) => new DOMRect(x, y, w, h);
  function measured(
    html: string,
    unit: 'words' | 'lines' = 'words',
    rebuild: (() => void) | null = null,
    axes: string[] = []
  ) {
    const scene = document.createElement('cv-scene');
    scene.style.contentVisibility = 'hidden';
    document.body.append(scene);
    const { el, slot, container } = host(html);
    scene.append(el);
    // Browser defaults absent from jsdom's computed styles. Geometry below is an explicit
    // browser-API input, not a claim that jsdom measures real fonts or wrapping.
    for (const node of [el, ...el.querySelectorAll<HTMLElement>('*')]) {
      if (!node.style.writingMode) node.style.writingMode = 'horizontal-tb';
      if (!node.style.direction) node.style.direction = 'ltr';
      if (!node.style.textDecorationLine) node.style.textDecorationLine = 'none';
      if (!node.style.visibility) node.style.visibility = 'visible';
    }
    const split = new TextSplit(el, slot, unit, rebuild, axes);
    splits.push(split);
    const source = container.querySelector<HTMLElement>('[part=split-source]')!;
    const copy = container.querySelector<HTMLElement>('[part=split]')!;
    source.getBoundingClientRect = jest.fn(() => rectangle(10, 20, 200, 80));
    copy.getBoundingClientRect = () => rectangle(10, 20, 200, 80);
    Object.defineProperty(source, 'offsetWidth', { value: 200 });
    Object.defineProperty(source, 'offsetHeight', { value: 80 });
    return { el, container, source, copy, scene, split };
  }
  beforeEach(() => {
    jest.useFakeTimers();
    rects = new Map([
      ['Hello', [rectangle(20, 30)]],
      ['world', [rectangle(80, 30)]],
      ['again', [rectangle(20, 60)]],
    ]);
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: function (this: Range) {
        return (
          rects.get(
            (this.startContainer.textContent ?? '').slice(this.startOffset, this.endOffset)
          ) ?? []
        );
      },
    });
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: class {
        disconnect = jest.fn();
        observe = jest.fn();
        constructor(readonly callback: () => void) {
          observers.push(this);
        }
      },
    });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn(() => ({ addEventListener: jest.fn(), removeEventListener: jest.fn() })),
    });
    Object.defineProperty(document, 'fonts', { configurable: true, value: new EventTarget() });
  });
  afterEach(() => {
    for (const split of splits.splice(0)) split.destroy();
    document.body.replaceChildren();
    observers.length = 0;
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('keeps author text selectable while the aria-hidden word copy groups touching punctuation', () => {
    rects.set('(', [rectangle(15, 30, 5)]);
    rects.set(')', [rectangle(60, 30, 5)]);
    rects.set(',', [rectangle(65, 30, 5)]);
    rects.set('!', [rectangle(120, 30, 5)]);
    const { el, container, source, copy, scene, split } = measured('(Hello), world!');
    container.style.setProperty('transform', 'translateX(40px)', 'important');
    expect(split.mount()).toBeNull();
    expect(split.pieces.map((p) => p.textContent)).toEqual(['(Hello),', 'world!']);
    expect(el.textContent).toBe('(Hello), world!');
    expect(copy.getAttribute('aria-hidden')).toBe('true');
    expect(source.style.opacity).toBe('0');
    expect([split.pieces[0]!.style.left, split.pieces[0]!.style.top]).toEqual(['5px', '10px']);
    expect(container.style.transform).toBe('translateX(40px)');
    expect(container.style.getPropertyPriority('transform')).toBe('important');
    expect(scene.style.contentVisibility).toBe('hidden');
    split.phase('entered');
    expect(source.style.opacity).toBe('');
    expect(copy.style.visibility).toBe('hidden');
  });

  it('uses unscaled coordinates and keeps the other font axes and gradient aligned', () => {
    const { split, source } = measured(
      "<span style=\"background-clip:text;background-image:linear-gradient(red,blue);font-variation-settings:'wght' 600, 'wdth' 85\">Hello</span>",
      'words',
      null,
      ['--cv-axis-wght']
    );
    source.getBoundingClientRect = () => rectangle(10, 20, 400, 160);
    const label = source.getRootNode() as ShadowRoot;
    const author = label.host.querySelector('span')!;
    // jsdom leaves font defaults empty; supply the browser's nonempty computed inputs.
    Object.assign(author.style, {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      fontWeight: '400',
      fontStyle: 'normal',
      fontStretch: 'normal',
      fontVariant: 'normal',
      fontFeatureSettings: 'normal',
      fontVariationSettings: '"wght" 600, "wdth" 85',
    });
    author.getBoundingClientRect = () => rectangle(10, 20, 400, 160);
    expect(split.mount()).toBeNull();
    expect([split.pieces[0]!.style.left, split.pieces[0]!.style.top]).toEqual(['5px', '5px']);
    const fragment = split.pieces[0]!.firstElementChild as HTMLElement;
    expect(fragment.style.fontVariationSettings).toContain('"wdth" 85');
    expect(fragment.style.fontVariationSettings).toContain('"wght" var(--cv-axis-wght)');
    expect(fragment.style.backgroundSize).toBe('200px 80px');
    expect(fragment.style.backgroundPosition).toBe('-5px -5px');
  });

  it('clips lines and reuses their animation elements when the text rewraps to fewer lines', () => {
    rects.set('world', [rectangle(20, 60)]);
    const { split, copy } = measured('Hello world', 'lines');
    expect(split.mount()).toBeNull();
    expect(split.pieces.map((p) => p.textContent)).toEqual(['Hello', 'world']);
    expect((copy.firstElementChild as HTMLElement).style.overflow).toBe('clip');
    const pieces = [...split.pieces];
    pieces[0]!.style.opacity = '0.4';
    rects.set('world', [rectangle(80, 30)]);
    split.schedule();
    jest.advanceTimersByTime(20);
    expect(split.pieces).toEqual(pieces);
    expect(pieces[0]!.textContent).toBe('Helloworld');
    expect(pieces[1]!.textContent).toBe('');
    expect(pieces[0]!.style.opacity).toBe('0.4');
    expect((copy.children[1] as HTMLElement).style.height).toBe('0px');
  });

  it('splits a word spanning lines from the supplied per-grapheme boxes', () => {
    rects.set('abcdef', [rectangle(20, 30, 30), rectangle(20, 60, 30)]);
    for (const [i, ch] of [...'abcdef'].entries())
      rects.set(ch, [rectangle(20 + (i % 3) * 10, i < 3 ? 30 : 60, 10)]);
    const { split } = measured('abcdef');
    expect(split.mount()).toBeNull();
    expect(split.pieces.map((p) => p.textContent)).toEqual(['abc', 'def']);
    expect(split.pieces.map((p) => p.style.top)).toEqual(['10px', '40px']);
  });

  it('keeps time-sourced piece identities as words are added or removed', () => {
    const { el, split } = measured('Hello world');
    expect(split.mount()).toBeNull();
    const pieces = [...split.pieces];
    el.firstChild!.textContent = 'Hello world again';
    split.schedule();
    jest.advanceTimersByTime(20);
    expect(split.pieces).toEqual(pieces);
    expect(pieces.map((p) => p.textContent)).toEqual(['Hello', 'worldagain']);
    el.firstChild!.textContent = 'Hello';
    split.schedule();
    jest.advanceTimersByTime(20);
    expect(pieces.map((p) => p.textContent)).toEqual(['Hello', '']);
    expect(pieces[1]!.style.width).toBe('0px');
  });

  it('requests one rebuild for a changed progress-sourced piece count and coalesces notifications', () => {
    const rebuild = jest.fn();
    const { el, split, source } = measured('Hello world', 'words', rebuild);
    expect(split.mount()).toBeNull();
    (source.getBoundingClientRect as jest.Mock).mockClear();
    el.firstChild!.textContent = 'Hello world again';
    split.schedule();
    split.schedule();
    document.fonts.dispatchEvent(new Event('loadingdone'));
    jest.advanceTimersByTime(20);
    expect(rebuild).toHaveBeenCalledTimes(1);
    expect(source.getBoundingClientRect).toHaveBeenCalledTimes(1);
    expect(split.pieces).toHaveLength(2);
    split.schedule();
    split.destroy();
    jest.advanceTimersByTime(20);
    expect(rebuild).toHaveBeenCalledTimes(1);
    expect(observers[0]!.disconnect).toHaveBeenCalled();
  });

  it.each([
    ['<span style="writing-mode:vertical-rl">Hello</span>', 'vertical writing'],
    ['<span style="direction:rtl">Hello</span>', 'right-to-left'],
    ['<span style="text-decoration-line:underline">Hello</span>', 'text decoration'],
    ['مرحبا', 'right-to-left'],
  ])('keeps unsupported text whole and restores transforms: %s', (html, reason) => {
    const { split, container, scene } = measured(html);
    container.style.scale = '2';
    expect(split.mount()).toContain(reason);
    expect(split.pieces).toHaveLength(0);
    expect(container.style.scale).toBe('2');
    expect(scene.style.contentVisibility).toBe('hidden');
  });

  it('ignores hidden or unmeasurable runs, and preserves the last valid copy during temporary skew or disconnection', () => {
    const { split, source, el } = measured(
      '<span style="visibility:hidden">again</span>Hello world'
    );
    expect(split.mount()).toBeNull();
    expect(split.pieces.map((p) => p.textContent)).toEqual(['Hello', 'world']);
    const pieces = [...split.pieces];
    source.getBoundingClientRect = () => rectangle(10, 20, 400, 80);
    split.schedule();
    jest.advanceTimersByTime(20);
    expect(split.pieces).toEqual(pieces);
    source.getBoundingClientRect = () => rectangle(10, 20, 200, 80);
    rects.clear();
    split.schedule();
    jest.advanceTimersByTime(20);
    expect(split.pieces.map((p) => p.textContent)).toEqual(['Hello', 'world']);
    el.remove();
    split.schedule();
    jest.advanceTimersByTime(20);
    expect(split.pieces).toEqual(pieces);
  });
});
