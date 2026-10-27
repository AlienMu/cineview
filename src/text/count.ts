/**
 * Count (lexicon #13 scroll-triggered count): a number rolls up to its value on digit wheels.
 *
 * The number stays text in the light DOM, its final value, for layout, accessibility, selection
 * and find. An aria-hidden copy in the shadow root draws it with a wheel per digit (separators,
 * signs and units stay text), over the original's measured place; the two take turns showing, the
 * copy only while counting. Figures are tabular on both, so the count never shifts the line.
 *
 * The count is a track (0–1) on an adapted layer (render/layers.ts) whose element holds the
 * original and the copy: each frame becomes the value n = to · (1 − 10^(−d·t)) / (1 − 10^(−d))
 * for d digits, which slows by powers of ten, so the wheels stop from left to right. The last
 * wheel turns with n; each other wheel steps as an odometer's does, while the wheel to its right
 * passes from 9 to 0. Positions travel as custom properties, so every input writes them the same
 * way, clock keyframes included.
 *
 * The number is one run of digits (with separators between them) in the element's only run of
 * text: `<cv-animate fx="count"><h2>$4.5M</h2></cv-animate>`. Measured again when the size, text,
 * fonts or theme change: the same number is drawn again in place; a new one rebuilds the count, as
 * clock keyframes hold the values they were made with.
 */
import type { Effect } from '../core/fx';
import type { Frame, Tracks } from '../core/props';
import type { LayerPlan } from '../render/layers';
import { watchText } from './watch';

/** Custom properties the layer writes: whether the copy shows, and each wheel's position. */
const ON = '--cv-count-on';
const WHEEL = '--cv-count-';
/** Digits with the separators between them (grouping, decimal, spaces). */
const NUMBER = /\d(?:[\d.,'\s]*\d)?/g;
/** Computed styles the copy takes from the number's element. */
const COPIED = [
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-stretch',
  'font-variant',
  'font-feature-settings',
  'font-variation-settings',
  'font-kerning',
  'letter-spacing',
  'word-spacing',
  'text-transform',
  'color',
  '-webkit-text-fill-color',
  'text-shadow',
] as const;
/** Lexicon #13: wheels fade out .16em above and below the line. */
const FADE = 'linear-gradient(transparent,#000 .16em,#000 calc(100% - .16em),transparent)';
const WHEEL_CSS = `display:inline-block;vertical-align:top;height:1lh;overflow:clip;margin:-.16em 0;padding:.16em 0;-webkit-mask-image:${FADE};mask-image:${FADE}`;

/**
 * Each shadow layer's count track moves to a count plan of its own (the copy's layer); the layer
 * keeps its other tracks.
 */
export function planCounts(layers: LayerPlan[]): LayerPlan[] {
  const counts: LayerPlan[] = [];
  const parts = (list: Effect[]): [Effect[], Effect[]] => {
    const rest: Effect[] = [];
    const count: Effect[] = [];
    for (const e of list) {
      const track = e.tracks.count;
      if (!track) {
        rest.push(e);
        continue;
      }
      const tracks: Tracks = { ...e.tracks };
      delete tracks.count;
      const entries = e.entries.filter(([p]) => p !== 'count');
      if (entries.length || e.vars.length) rest.push({ ...e, tracks, entries });
      count.push({ ...e, tracks: { count: track }, entries: [['count', ...track]], vars: [] });
    }
    return [rest, count];
  };
  layers.forEach((l, i) => {
    if (l.select !== 'rest' || ![...l.effects, ...l.exitEffects].some((e) => e.tracks.count)) {
      return;
    }
    const [effects, countEffects] = parts(l.effects);
    const [exitEffects, countExits] = parts(l.exitEffects);
    layers[i] = { ...l, effects, exitEffects };
    counts.push({ ...l, effects: countEffects, exitEffects: countExits });
  });
  return counts;
}

interface Found {
  node: Text;
  /** The run's trimmed text, as offsets in the node. */
  start: number;
  end: number;
  /** Offsets of the number in the node. */
  from: number;
  to: number;
  digits: string;
}

/** The element's number, or why it has none to count. */
function find(host: HTMLElement): Found | string {
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  let node: Text | null = null;
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    if (!n.data.trim()) continue;
    if (node) return 'the number needs to be its only run of text';
    node = n;
  }
  const data = node?.data ?? '';
  const numbers = [...data.matchAll(NUMBER)];
  if (!node || !numbers.length) return 'there is no number in its text';
  if (numbers.length > 1) return 'its text holds more than one number';
  const m = numbers[0]!;
  const digits = m[0].replace(/\D/g, '');
  if (digits.length > 15) return 'the number has more than 15 digits';
  const start = data.length - data.trimStart().length;
  return {
    node,
    start,
    end: data.trimEnd().length,
    from: m.index,
    to: m.index + m[0].length,
    digits,
  };
}

export class Counter {
  /** The adapted layer's element: the original (the slot) and the copy, taking turns. */
  readonly el: HTMLElement;
  private readonly source: HTMLElement;
  private readonly copy: HTMLElement;
  private readonly line: HTMLElement;
  private found: Found | null = null;
  private unwatch: (() => void) | null = null;
  private raf = 0;

  /** Wraps the slot once mounted; `rebuild` runs when the number changes. */
  constructor(
    private readonly host: HTMLElement,
    private readonly slot: HTMLSlotElement,
    private readonly rebuild: () => void
  ) {
    this.el = document.createElement('div');
    this.el.setAttribute('part', 'count');
    this.el.style.cssText = 'position:relative;font-variant-numeric:tabular-nums';
    this.source = document.createElement('div');
    this.source.setAttribute('part', 'count-source');
    this.source.style.opacity = `calc(1 - var(${ON}, 0))`;
    this.copy = document.createElement('div');
    this.copy.setAttribute('aria-hidden', 'true');
    this.copy.style.cssText = `position:absolute;inset:0;pointer-events:none;opacity:var(${ON}, 0)`;
    this.line = document.createElement('span');
    this.copy.append(this.line);
    this.el.append(this.source, this.copy);
  }

  /** The custom properties the layer writes. */
  get vars(): string[] {
    return [ON, ...[...(this.found?.digits ?? '')].map((_, i) => `${WHEEL}${i}`)];
  }

  /** Find the number and draw the copy. A reason when there is none to count. */
  mount(): string | null {
    // Keep watching an invalid value: async content can replace it with a number later.
    this.unwatch = watchText(this.host, () => this.schedule());
    const found = find(this.host);
    if (typeof found === 'string') return found;
    this.found = found;
    this.slot.replaceWith(this.el);
    this.source.append(this.slot);
    this.draw();
    return null;
  }

  /** A frame's count (0–1) as wheel positions; the copy shows until the count is complete. */
  readonly adapt = (frame: Frame): void => {
    const digits = this.found?.digits ?? '';
    const d = digits.length;
    const t = Math.min(1, Math.max(0, frame.count));
    const to = Number(digits);
    const n = (to * (1 - 10 ** (-d * t))) / (1 - 10 ** -d);
    frame.vars.set(ON, t < 1 ? '1' : '0');
    // Right to left: a wheel steps on while the one to its right passes from 9 to 0.
    let right = 0;
    for (let i = d - 1; i >= 0; i--) {
      const q = n / 10 ** (d - 1 - i);
      const pos = i === d - 1 ? q % 10 : (Math.floor(q) % 10) + Math.max(0, right - 9);
      right = pos;
      frame.vars.set(`${WHEEL}${i}`, String(Math.round(pos * 1e3) / 1e3));
    }
  };

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.unwatch?.();
    this.unwatch = null;
  }

  /** The copy: the run's text with a wheel for each digit, on the original's place. */
  private draw(): void {
    const { node, start, end, from, to } = this.found!;
    const data = node.data;
    const line = this.line;
    line.textContent = '';
    line.append(data.slice(start, from));
    let wheel = 0;
    for (const c of data.slice(from, to)) {
      if (!/\d/.test(c)) {
        line.append(c);
        continue;
      }
      const box = document.createElement('span');
      box.style.cssText = WHEEL_CSS;
      const strip = document.createElement('span');
      // Eleven figures, 0 to 9 and 0 again, so a wheel passing from 9 to 0 rolls on.
      strip.style.cssText = `display:block;white-space:pre;translate:0 calc(var(${WHEEL}${wheel++}, 0) * -100% / 11)`;
      strip.textContent = [...'01234567890'].join('\n');
      box.append(strip);
      line.append(box);
    }
    line.append(data.slice(to, end));
    this.measure();
  }

  /** Place the copy's line on the original's, in the layer's untransformed pixels. */
  private measure(): void {
    const { node, start, end } = this.found!;
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    const r = range.getBoundingClientRect();
    const c = this.el.getBoundingClientRect();
    // The layer shares the transforms of the layers around it: undo their scale.
    const sx = this.el.offsetWidth ? c.width / this.el.offsetWidth : 1;
    const sy = this.el.offsetHeight ? c.height / this.el.offsetHeight : 1;
    const style = getComputedStyle(node.parentElement!);
    let css = 'position:absolute;white-space:pre;';
    for (const prop of COPIED) css += `${prop}:${style.getPropertyValue(prop)};`;
    // Whole pixels a line, so a wheel at rest moves its figures by whole pixels and they render as
    // the number's do; the half leading this adds is taken off the top.
    const height = r.height / sy;
    const line = Math.round(height);
    this.line.style.cssText =
      css +
      `font-variant-numeric:tabular-nums;line-height:${line}px;` +
      `left:${(r.left - c.left) / sx}px;top:${(r.top - c.top) / sy - (line - height) / 2}px`;
  }

  /** Read the number again on the next frame (several triggers in one frame read once). */
  private schedule(): void {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      if (!this.host.isConnected) return;
      const found = find(this.host);
      if (typeof found === 'string') {
        if (this.found) this.rebuild();
        return;
      }
      if (found.digits !== this.found?.digits) {
        this.rebuild();
        return;
      }
      this.found = found;
      this.draw();
    });
  }
}
