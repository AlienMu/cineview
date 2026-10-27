import { parseFx, type Effect, type Source } from '../core/fx';
import { identityFrame } from '../core/props';
import { planLayers } from '../render/layers';
import { Counter, planCounts } from './count';

const fx = (text: string): Effect[] => parseFx(text, () => undefined);
const plans = (source: Source, text: string) =>
  planLayers(new Map([[source, { effects: fx(text), exits: [] }]]), 'scene');

/** jsdom has no layout, observers or media queries: stand-ins for what the copy reads. */
beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  window.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
  Range.prototype.getBoundingClientRect ??= () => new DOMRect(0, 0, 0, 0);
});

function host(html: string): { el: HTMLElement; slot: HTMLSlotElement; layer: HTMLElement } {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.append(el);
  const root = el.attachShadow({ mode: 'open' });
  const layer = document.createElement('div');
  const slot = document.createElement('slot');
  layer.append(slot);
  root.append(layer);
  return { el, slot, layer };
}

/** Wheel positions and whether the copy shows, at count progress t. */
function wheels(counter: Counter, t: number): { on: string; pos: number[] } {
  const frame = identityFrame();
  frame.count = t;
  counter.adapt(frame);
  const pos = counter.vars.slice(1).map((name) => Number(frame.vars.get(name)));
  return { on: frame.vars.get('--cv-count-on')!, pos };
}

describe('count (lexicon #13)', () => {
  afterEach(() => (document.body.textContent = ''));

  it('moves the count track to a plan of its own; the layer keeps the rest', () => {
    const layers = plans('enter', 'count, rise');
    const counts = planCounts(layers);
    expect(counts.map((p) => p.effects.map((e) => Object.keys(e.tracks)))).toEqual([[['count']]]);
    expect(layers[0]!.effects.map((e) => Object.keys(e.tracks))).toEqual([['opacity', 'y']]);
    expect(planCounts(plans('enter', 'rise'))).toEqual([]);
  });

  it('draws a wheel per digit over the number; separators, signs and units stay text', () => {
    const { el, slot, layer } = host('<h2> $1,234.5M </h2>');
    const counter = new Counter(el, slot, () => undefined);
    expect(counter.mount()).toBeNull();
    const source = layer.querySelector('[part=count-source]')!;
    const copy = counter.el.lastElementChild!;
    expect(counter.el.parentElement).toBe(layer);
    expect(source.firstElementChild).toBe(slot);
    expect(copy.getAttribute('aria-hidden')).toBe('true');
    expect(counter.el.style.fontVariantNumeric).toBe('tabular-nums');
    const line = copy.firstElementChild!;
    expect(line.children).toHaveLength(5);
    expect([...line.childNodes].map((n) => (n.nodeType === 3 ? n.textContent : '#'))).toEqual([
      '$',
      '#',
      ',',
      '#',
      '#',
      '#',
      '.',
      '#',
      'M',
    ]);
    expect(counter.vars).toEqual([
      '--cv-count-on',
      '--cv-count-0',
      '--cv-count-1',
      '--cv-count-2',
      '--cv-count-3',
      '--cv-count-4',
    ]);
    // The number itself is untouched.
    expect(el.textContent).toBe(' $1,234.5M ');
    counter.destroy();
  });

  it('rolls up by powers of ten: wheels stop left to right, as an odometer steps', () => {
    const { el, slot } = host('1234');
    const counter = new Counter(el, slot, () => undefined);
    counter.mount();
    expect(wheels(counter, 0)).toEqual({ on: '1', pos: [0, 0, 0, 0] });
    expect(wheels(counter, 1)).toEqual({ on: '0', pos: [1, 2, 3, 4] });
    // Half way: n = 1234 × (1 − 10^−2) / (1 − 10^−4) ≈ 1221.78.
    expect(wheels(counter, 0.5).pos).toEqual([1, 2, 2, 1.782]);
    // The tens wheel turns only while the units wheel passes from 9 to 0.
    const at = (n: number): number => -Math.log10(1 - (n * (1 - 1e-4)) / 1234) / 4;
    const passing = wheels(counter, at(1229.5)).pos;
    expect(passing[3]).toBeCloseTo(9.5, 2);
    expect(passing[2]).toBeCloseTo(2.5, 2);
    expect(passing[1]).toBe(2);
    expect(wheels(counter, at(1228.5)).pos[2]).toBe(2);
    counter.destroy();
  });

  it('refuses text without exactly one number in one run', () => {
    const refusal = (html: string): string | null => {
      const { el, slot, layer } = host(html);
      const counter = new Counter(el, slot, () => undefined);
      const reason = counter.mount();
      // Refused, the slot stays where it was.
      if (reason) expect(slot.parentElement).toBe(layer);
      counter.destroy();
      return reason;
    };
    expect(refusal('soon')).toMatch(/no number/);
    expect(refusal('12 345 km')).toBeNull();
    expect(refusal('12 to 34 km')).toMatch(/more than one number/);
    expect(refusal('12 or 34')).toMatch(/more than one number/);
    expect(refusal('<b>12</b> or <i>34</i>')).toMatch(/only run of text/);
    expect(refusal('1234567890123456')).toMatch(/more than 15 digits/);
  });
});

describe('count text lifetime', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    document.body.replaceChildren();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('keeps observing an invalid value until it becomes a number', async () => {
    const { el, slot } = host('');
    const rebuild = jest.fn();
    const counter = new Counter(el, slot, rebuild);
    expect(counter.mount()).toMatch(/no number/);
    el.textContent = 'Loading';
    await jest.advanceTimersByTimeAsync(40);
    expect(rebuild).not.toHaveBeenCalled();
    el.textContent = '512';
    await jest.advanceTimersByTimeAsync(40);
    expect(rebuild).toHaveBeenCalledTimes(1);
    counter.destroy();
  });

  it('coalesces synchronous text changes and stops pending recovery on destroy', async () => {
    const { el, slot } = host('128');
    const rebuild = jest.fn();
    const counter = new Counter(el, slot, rebuild);
    counter.mount();
    el.textContent = '';
    el.textContent = '256';
    await jest.advanceTimersByTimeAsync(40);
    expect(rebuild).toHaveBeenCalledTimes(1);
    rebuild.mockClear();
    el.textContent = '';
    counter.destroy();
    await jest.advanceTimersByTimeAsync(40);
    el.textContent = '512';
    await jest.advanceTimersByTimeAsync(40);
    expect(rebuild).not.toHaveBeenCalled();
  });
});
