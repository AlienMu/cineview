/**
 * Split text on a measured mirror (plan v3 §5, F5; lexicon #10 word scrub, #32 split reveal).
 *
 * The author's text stays in the light DOM, so layout, accessibility, selection and find keep
 * working on it. The browser's own word boxes are measured (Range.getClientRects) and an
 * aria-hidden copy is drawn in the host's shadow root, one box per word or per line, for the
 * element's effects to animate. While the copy shows, the original is hidden with opacity on its
 * wrapper, never with transparent text, so emoji and gradient text do not double; find and
 * selection highlights on the original are not visible meanwhile.
 *
 * Words keep the punctuation that touches them (a closing mark with the word before it, an opening
 * one with the word after it), so CJK punctuation never stands alone. Lines clip what moves inside
 * them (lexicon #32: the text rises out of the page rather than over it).
 *
 * Measured in the host's untransformed coordinates: the layers' own transforms are suspended while
 * measuring and a uniform scale from ancestors is divided out; rotation or skew refuses the
 * measurement, and the element then animates as a whole. Measured again when fonts load, the size
 * or the text changes, the stage's `data-cv-theme` or a `lang` changes, a colour-scheme media
 * query flips, or the scene activates. The same number of pieces moves the copy in place (running
 * animations keep their elements). Another number rebuilds the stage on a progress source; on a
 * time source, whose pieces were timed with the scene, the extra lines or words join the last
 * piece (or pieces stay empty) instead, so a resize never replays what the reader has seen.
 */

export type SplitUnit = 'words' | 'lines';

/** Computed styles reproduced on each fragment of the copy. */
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
  'font-optical-sizing',
  'letter-spacing',
  'word-spacing',
  'text-transform',
  'text-rendering',
  'color',
  '-webkit-text-fill-color',
  '-webkit-text-stroke',
  'background-image',
  'background-clip',
  '-webkit-background-clip',
  'text-shadow',
] as const;

/** Content the copy cannot draw: split works on text. */
const NOT_TEXT =
  'img,svg,video,canvas,iframe,picture,object,embed,input,textarea,select,button,math';
const RTL = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc]/;
const OPENING = /^[\p{Ps}\p{Pi}]+$/u;
const SPACE = /^\s+$/;

interface Fragment {
  text: string;
  /** Box relative to the text's origin, in unscaled CSS px. */
  left: number;
  top: number;
  right: number;
  bottom: number;
  css: string;
}

interface PieceBox {
  frags: Fragment[];
  line: number;
}

interface Model {
  pieces: PieceBox[];
  lines: Array<{ top: number; bottom: number }>;
}

const union = (frags: readonly Fragment[]): { l: number; t: number; r: number; b: number } => {
  let l = Infinity;
  let t = Infinity;
  let r = -Infinity;
  let b = -Infinity;
  for (const f of frags) {
    l = Math.min(l, f.left);
    t = Math.min(t, f.top);
    r = Math.max(r, f.right);
    b = Math.max(b, f.bottom);
  }
  return { l, t, r, b };
};

export class TextSplit {
  /** What the effects animate: one element per word, or per line. */
  pieces: HTMLElement[] = [];
  /** The end state is the element at rest: the original can show once the effects complete. */
  atRest = true;
  private readonly src: HTMLElement;
  private readonly root: HTMLElement;
  private lines: HTMLElement[] = [];
  private shown = false;
  private observers: Array<{ disconnect(): void }> = [];
  private raf = 0;
  private removeFonts: (() => void) | null = null;

  /**
   * Wraps the slot in `container` (the innermost layer or the shadow root) in a source wrapper and
   * adds the copy beside it. `rebuild` runs when a measurement finds another number of pieces; null
   * keeps the number (time sources).
   */
  constructor(
    private readonly host: HTMLElement,
    slot: HTMLSlotElement,
    readonly unit: SplitUnit,
    private readonly rebuild: (() => void) | null
  ) {
    const container = slot.parentNode as HTMLElement | ShadowRoot;
    if (container instanceof HTMLElement) container.style.position = 'relative';
    this.src = document.createElement('div');
    this.src.setAttribute('part', 'split-source');
    slot.replaceWith(this.src);
    this.src.append(slot);
    this.root = document.createElement('div');
    this.root.setAttribute('aria-hidden', 'true');
    this.root.setAttribute('part', 'split');
    this.root.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    container.append(this.root);
  }

  /** Measure and draw the copy. A reason when the text cannot be split (it then stays whole). */
  mount(): string | null {
    const result = this.measure();
    if (typeof result === 'string') return result;
    if (!result.pieces.length) return 'there is no text to split';
    this.render(result);
    // Until the input says otherwise the copy shows, with the pieces as the layers write them.
    this.show(true);
    this.watch();
    return null;
  }

  /** Copy shown (original hidden) or not. */
  show(on: boolean): void {
    if (on === this.shown) return;
    this.shown = on;
    this.root.style.visibility = on ? '' : 'hidden';
    this.src.style.opacity = on ? '0' : '';
  }

  /** Time sources: the copy shows until the entrance has run (and again when it replays). */
  phase(phase: string): void {
    this.show(!(phase === 'entered' || phase === 'exiting' || phase === 'exited') || !this.atRest);
  }

  /** Progress sources: the copy shows until the effects complete. */
  progress(p: number): void {
    this.show(p < 1 || !this.atRest);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    for (const o of this.observers) o.disconnect();
    this.observers = [];
    this.removeFonts?.();
    this.removeFonts = null;
  }

  // ---- measuring ----------------------------------------------------------------------------------

  private measure(): Model | string {
    const host = this.host;
    if (host.querySelector(NOT_TEXT)) return 'it contains more than text';
    // Drag skips scenes outside its window (content-visibility): lay the scene out to measure.
    const scene = host.closest<HTMLElement>('cv-scene');
    const skipped = scene?.style.contentVisibility ?? '';
    if (scene) scene.style.contentVisibility = 'visible';
    const suspended = this.suspendTransforms();
    try {
      return this.read();
    } finally {
      for (const undo of suspended) undo();
      if (scene) scene.style.contentVisibility = skipped;
    }
  }

  /** The layers around the text lose their transforms until the returned undos run. */
  private suspendTransforms(): Array<() => void> {
    const undos: Array<() => void> = [];
    for (let el = this.src.parentElement; el; el = el.parentElement) {
      const style = el.style;
      for (const prop of ['transform', 'translate', 'rotate', 'scale']) {
        const value = style.getPropertyValue(prop);
        const priority = style.getPropertyPriority(prop);
        // Important beats running animations (cascade): the measurement sees the untransformed box.
        style.setProperty(prop, 'none', 'important');
        undos.push(() => {
          if (value) style.setProperty(prop, value, priority);
          else style.removeProperty(prop);
        });
      }
    }
    return undos;
  }

  private read(): Model | string {
    const host = this.host;
    const origin = this.src.getBoundingClientRect();
    const width = this.src.offsetWidth;
    const height = this.src.offsetHeight;
    if (!width || !height) return { pieces: [], lines: [] };
    const sx = origin.width / width;
    const sy = origin.height / height;
    // Rotation and skew make client rects bounding boxes: refuse rather than misplace.
    if (Math.abs(sx - sy) > 0.01 * Math.max(sx, sy)) return 'it is rotated or skewed';
    const scale = sx || 1;
    const hostStyle = getComputedStyle(host);
    if (hostStyle.writingMode !== 'horizontal-tb') return 'vertical writing is not supported';
    if (hostStyle.direction === 'rtl') return 'right-to-left text is not supported';

    const segmenter = new Intl.Segmenter(
      host.closest('[lang]')?.getAttribute('lang') || undefined,
      {
        granularity: 'word',
      }
    );
    const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    const styles = new Map<Element, string | null>();
    const styleOf = (el: Element): string | null => {
      let css = styles.get(el);
      if (css !== undefined) return css;
      const cs = getComputedStyle(el);
      if (cs.visibility !== 'visible') css = null;
      else {
        css = '';
        for (const prop of COPIED) css += `${prop}:${cs.getPropertyValue(prop)};`;
        if (cs.backgroundClip === 'text' || cs.webkitBackgroundClip === 'text') {
          // Gradient text paints its parent's box: keep that box for the copy.
          const box = el.getBoundingClientRect();
          css += `--cv-box:${(box.left - origin.left) / scale} ${(box.top - origin.top) / scale} ${box.width / scale} ${box.height / scale};`;
        }
      }
      styles.set(el, css);
      return css;
    };
    const issues = (el: Element): string | null => {
      const cs = getComputedStyle(el);
      if (cs.writingMode !== 'horizontal-tb') return 'vertical writing is not supported';
      if (cs.direction === 'rtl') return 'right-to-left text is not supported';
      if (cs.textDecorationLine !== 'none') return 'text decoration is not supported';
      return null;
    };
    const checked = new Set<Element>();

    const frags: Array<Fragment & { word: boolean; open: boolean; gap: boolean }> = [];
    const range = document.createRange();
    const rectOf = (node: Text, start: number, end: number): DOMRect[] => {
      range.setStart(node, start);
      range.setEnd(node, end);
      return [...range.getClientRects()].filter((r) => r.width >= 0.5 && r.height > 0);
    };
    const box = (r: DOMRect): Pick<Fragment, 'left' | 'top' | 'right' | 'bottom'> => ({
      left: (r.left - origin.left) / scale,
      top: (r.top - origin.top) / scale,
      right: (r.right - origin.left) / scale,
      bottom: (r.bottom - origin.top) / scale,
    });
    let gap = true;
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    for (
      let node = walker.nextNode() as Text | null;
      node;
      node = walker.nextNode() as Text | null
    ) {
      const text = node.data;
      const parent = node.parentElement;
      if (!parent || !text.trim()) {
        if (text) gap = true;
        continue;
      }
      if (RTL.test(text)) return 'right-to-left text is not supported';
      if (!checked.has(parent)) {
        checked.add(parent);
        const issue = issues(parent);
        if (issue) return issue;
      }
      const css = styleOf(parent);
      if (css === null) {
        gap = true;
        continue;
      }
      for (const seg of segmenter.segment(text)) {
        if (SPACE.test(seg.segment)) {
          gap = true;
          continue;
        }
        const end = seg.index + seg.segment.length;
        const rects = rectOf(node, seg.index, end);
        if (!rects.length) continue;
        const word = seg.isWordLike === true;
        const open = !word && OPENING.test(seg.segment);
        if (rects.length === 1) {
          frags.push({ text: seg.segment, ...box(rects[0]!), css, word, open, gap });
        } else {
          // Broken across lines (CJK lines break inside words): one fragment per line part.
          let part: (Fragment & { word: boolean; open: boolean; gap: boolean }) | null = null;
          for (const g of graphemes.segment(seg.segment)) {
            const at = seg.index + g.index;
            const r = rectOf(node, at, at + g.segment.length)[0];
            if (!r) continue;
            const b = box(r);
            if (part && Math.abs(b.top - part.top) < (part.bottom - part.top) / 2) {
              part.text += g.segment;
              part.right = Math.max(part.right, b.right);
              part.bottom = Math.max(part.bottom, b.bottom);
            } else {
              if (part) frags.push(part);
              part = { text: g.segment, ...b, css, word, open, gap: part ? true : gap };
            }
          }
          if (part) frags.push(part);
        }
        gap = false;
      }
    }

    // Lines by vertical centre.
    const lines: Array<{ top: number; bottom: number; centre: number }> = [];
    const lineOf = (f: Fragment): number => {
      const c = (f.top + f.bottom) / 2;
      const h = (f.bottom - f.top) / 2;
      const i = lines.findIndex((l) => Math.abs(l.centre - c) < h);
      if (i >= 0) {
        const l = lines[i]!;
        l.top = Math.min(l.top, f.top);
        l.bottom = Math.max(l.bottom, f.bottom);
        return i;
      }
      lines.push({ top: f.top, bottom: f.bottom, centre: c });
      return lines.length - 1;
    };

    // Pieces: words with the punctuation that touches them.
    const pieces: PieceBox[] = [];
    let opening: Fragment[] = [];
    let openLine = -1;
    for (const f of frags) {
      const line = lineOf(f);
      const last = pieces[pieces.length - 1];
      if (f.open) {
        if (openLine !== line) opening = [];
        opening.push(f);
        openLine = line;
        continue;
      }
      if (!f.word && !f.gap && last && last.line === line && !opening.length) {
        last.frags.push(f);
        continue;
      }
      pieces.push({ frags: openLine === line ? [...opening, f] : [f], line });
      opening = [];
      openLine = -1;
    }
    if (opening.length) pieces.push({ frags: opening, line: openLine });
    return { pieces, lines: lines.map(({ top, bottom }) => ({ top, bottom })) };
  }

  // ---- drawing ------------------------------------------------------------------------------------

  /** Units of animation in this model: its lines or its pieces. */
  private count(model: Model): number {
    return this.unit === 'lines' ? model.lines.length : model.pieces.length;
  }

  private render(model: Model): void {
    if (!this.pieces.length) {
      if (this.unit === 'lines') {
        for (let i = 0; i < model.lines.length; i++) {
          const line = document.createElement('div');
          const inner = document.createElement('div');
          inner.style.cssText = 'position:absolute;inset:0';
          line.append(inner);
          this.root.append(line);
          this.lines.push(line);
          this.pieces.push(inner);
        }
      } else {
        for (let i = 0; i < model.pieces.length; i++) {
          const span = document.createElement('span');
          span.style.position = 'absolute';
          this.root.append(span);
          this.pieces.push(span);
        }
      }
    }
    // Units beyond the pieces join the last one (a time source keeps its number of pieces).
    const last = this.pieces.length - 1;
    const slot = (i: number): number => Math.min(i, last);
    if (this.unit === 'lines') {
      const boxes = this.pieces.map(() => ({ top: Infinity, bottom: -Infinity }));
      model.lines.forEach((l, i) => {
        const box = boxes[slot(i)]!;
        box.top = Math.min(box.top, l.top);
        box.bottom = Math.max(box.bottom, l.bottom);
      });
      boxes.forEach((box, i) => {
        const empty = box.top === Infinity;
        // The line clips what moves inside it, with room for ascenders and descenders.
        this.lines[i]!.style.cssText =
          `position:absolute;left:0;right:0;top:${empty ? 0 : box.top}px;height:${empty ? 0 : box.bottom - box.top}px;overflow:clip;overflow-clip-margin:.15em`;
        this.pieces[i]!.textContent = '';
      });
      for (const p of model.pieces) {
        const k = slot(p.line);
        for (const f of p.frags) this.pieces[k]!.append(this.fragment(f, 0, boxes[k]!.top));
      }
    } else {
      const groups: Fragment[][] = this.pieces.map(() => []);
      model.pieces.forEach((p, i) => groups[slot(i)]!.push(...p.frags));
      groups.forEach((frags, i) => {
        const span = this.pieces[i]!;
        span.textContent = '';
        const { l, t, r, b } = frags.length ? union(frags) : { l: 0, t: 0, r: 0, b: 0 };
        // Box only: what the layers wrote on the piece stays.
        span.style.left = `${l}px`;
        span.style.top = `${t}px`;
        span.style.width = `${r - l}px`;
        span.style.height = `${b - t}px`;
        for (const f of frags) span.append(this.fragment(f, l, t));
      });
    }
  }

  /** One run of text at its measured place, relative to its piece. */
  private fragment(f: Fragment, left: number, top: number): HTMLSpanElement {
    const span = document.createElement('span');
    span.textContent = f.text;
    let css = `position:absolute;white-space:pre;left:${f.left - left}px;top:${f.top - top}px;line-height:${f.bottom - f.top}px;${f.css}`;
    const m = /--cv-box:([^ ]+) ([^ ]+) ([^ ]+) ([^;]+);/.exec(f.css);
    if (m) {
      // Re-anchor the gradient to its element's box so the copy paints the same colours.
      const [bl, bt, bw, bh] = m.slice(1).map(Number) as [number, number, number, number];
      css += `background-size:${bw}px ${bh}px;background-position:${bl - f.left}px ${bt - f.top}px;background-repeat:no-repeat;`;
    }
    span.style.cssText = css;
    return span;
  }

  // ---- measuring again ----------------------------------------------------------------------------

  private watch(): void {
    const again = (): void => this.schedule();
    let first = true;
    const ro = new ResizeObserver(() => {
      // The first callback reports the size just measured.
      if (first) first = false;
      else again();
    });
    ro.observe(this.host);
    const text = new MutationObserver(again);
    text.observe(this.host, { childList: true, characterData: true, subtree: true });
    const attrs = new MutationObserver(again);
    attrs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang', 'data-cv-theme'],
      subtree: true,
    });
    const media = [
      '(prefers-color-scheme: dark)',
      '(forced-colors: active)',
      '(prefers-contrast: more)',
    ]
      .map((q) => matchMedia(q))
      .filter((m) => typeof m.addEventListener === 'function');
    for (const m of media) m.addEventListener('change', again);
    this.observers.push(ro, text, attrs, {
      disconnect: () => {
        for (const m of media) m.removeEventListener('change', again);
      },
    });
    const fonts = document.fonts as FontFaceSet | undefined;
    if (fonts?.addEventListener) {
      fonts.addEventListener('loadingdone', again);
      this.removeFonts = () => fonts.removeEventListener('loadingdone', again);
    }
  }

  /** Measure again on the next frame (several triggers in one frame measure once). */
  schedule(): void {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      if (!this.host.isConnected) return;
      const result = this.measure();
      // Rotated or empty for now (a hidden scene): keep the copy as it is.
      if (typeof result === 'string' || !result.pieces.length) return;
      if (this.rebuild && this.count(result) !== this.pieces.length) this.rebuild();
      else this.render(result);
    });
  }
}
