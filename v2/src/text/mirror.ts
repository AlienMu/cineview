/**
 * Measured mirror (plan v3 §5) — phase-0 spike.
 *
 * The author's text stays in light DOM (layout, accessibility, selection, find).
 * We measure the browser's own word boxes with Range.getClientRects(), group
 * them into lines, and draw an aria-hidden copy in the host's shadow root that
 * can be animated per line or per word. The original is hidden with opacity on
 * its layer (not transparent text), so emoji and gradient text never double.
 */

export interface MirrorPiece {
  el: HTMLSpanElement;
  line: number;
}

export interface Mirror {
  root: HTMLElement;
  pieces: MirrorPiece[];
  lines: HTMLElement[];
  measureMs: number;
  remove(): void;
}

const COPIED = [
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-stretch',
  'font-variant',
  'font-feature-settings',
  'font-variation-settings',
  'letter-spacing',
  'word-spacing',
  'text-transform',
  'color',
  '-webkit-text-fill-color',
  'background-image',
  'background-clip',
  '-webkit-background-clip',
  'text-shadow',
  'line-height',
] as const;

/** Style subset the mirror reproduces; anything else falls back to whole-element animation. */
export function unsupportedStyle(el: Element): string | null {
  const cs = getComputedStyle(el);
  if (cs.writingMode !== 'horizontal-tb') return 'writing-mode';
  if (cs.direction === 'rtl') return 'rtl';
  if (cs.textDecorationLine !== 'none') return 'text-decoration';
  return null;
}

export function buildMirror(
  host: HTMLElement,
  overlayParent: HTMLElement,
  unit: 'lines' | 'words'
): Mirror {
  const t0 = performance.now();
  const origin = host.getBoundingClientRect();
  const segmenter = new Intl.Segmenter(host.lang || document.documentElement.lang || undefined, {
    granularity: 'word',
  });
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  const boxes: Array<{
    text: string;
    rect: DOMRect;
    style: CSSStyleDeclaration;
    clipRect: DOMRect | null;
  }> = [];
  const range = document.createRange();
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const text = node.data;
    if (!text.trim()) continue;
    const parent = node.parentElement!;
    const style = getComputedStyle(parent);
    // Gradient text paints its background across the parent box; keep that box for alignment.
    const clipRect =
      style.backgroundClip === 'text' || style.webkitBackgroundClip === 'text'
        ? parent.getBoundingClientRect()
        : null;
    for (const seg of segmenter.segment(text)) {
      if (!seg.segment.trim()) continue;
      range.setStart(node, seg.index);
      range.setEnd(node, seg.index + seg.segment.length);
      const rects = range.getClientRects();
      // A wrapped segment yields several rects; keep the largest piece per rect row.
      for (const rect of rects) {
        if (rect.width < 0.5) continue;
        boxes.push({ text: rects.length === 1 ? seg.segment : seg.segment, rect, style, clipRect });
        break;
      }
    }
  }
  const measureMs = performance.now() - t0;

  // Group into lines by vertical centre.
  const lineTops: number[] = [];
  const lineOf = (r: DOMRect): number => {
    const c = r.top + r.height / 2;
    for (let i = 0; i < lineTops.length; i++)
      if (Math.abs(lineTops[i]! - c) < r.height / 2) return i;
    lineTops.push(c);
    return lineTops.length - 1;
  };

  const root = document.createElement('div');
  root.setAttribute('aria-hidden', 'true');
  root.setAttribute('part', 'mirror');
  root.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  const lines: HTMLElement[] = [];
  const pieces: MirrorPiece[] = [];
  const lineBox = new Map<number, { top: number; bottom: number }>();
  for (const b of boxes) {
    const i = lineOf(b.rect);
    const box = lineBox.get(i) ?? { top: Infinity, bottom: -Infinity };
    box.top = Math.min(box.top, b.rect.top);
    box.bottom = Math.max(box.bottom, b.rect.bottom);
    lineBox.set(i, box);
  }
  for (let i = 0; i < lineTops.length; i++) {
    const box = lineBox.get(i)!;
    const line = document.createElement('div');
    line.style.cssText = `position:absolute;left:0;right:0;top:${box.top - origin.top}px;height:${box.bottom - box.top}px;overflow:clip;overflow-clip-margin:0`;
    root.append(line);
    lines.push(line);
  }
  for (const b of boxes) {
    const i = lineOf(b.rect);
    const box = lineBox.get(i)!;
    const span = document.createElement('span');
    span.textContent = b.text;
    let css = `position:absolute;white-space:pre;left:${b.rect.left - origin.left}px;top:${b.rect.top - box.top}px;`;
    for (const prop of COPIED) css += `${prop}:${b.style.getPropertyValue(prop)};`;
    if (b.clipRect) {
      // Re-anchor the gradient to the parent's box so the copy paints the same colours.
      css += `background-size:${b.clipRect.width}px ${b.clipRect.height}px;background-position:${b.clipRect.left - b.rect.left}px ${b.clipRect.top - b.rect.top}px;background-repeat:no-repeat;`;
    }
    span.style.cssText = css;
    // Line height of the copy must match the measured box so glyphs sit on the same baseline.
    span.style.lineHeight = `${b.rect.height}px`;
    lines[i]!.append(span);
    pieces.push({ el: span, line: i });
  }
  overlayParent.append(root);
  return {
    root,
    pieces: unit === 'words' ? pieces : pieces,
    lines,
    measureMs,
    remove: () => root.remove(),
  };
}
