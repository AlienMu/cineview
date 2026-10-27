/**
 * Still pictures (plan v3 §6 F12, lexicon #25, #12 and #27). Blur over a large area is costly to
 * animate, so the effects here animate opacity only, over copies of the element's images:
 *
 * - `develop`: a blurred stand-in covers each image until it has loaded and decoded, then fades
 *   out over the sharp image (lexicon #25: 1.2 s). The stand-in is the author's small variant
 *   (`data-cv-standin`, e.g. a 16px WebP), else the image itself under a static blur.
 * - Blur on a large picture: a copy blurred as much as the effect ever blurs sits over the image
 *   and its opacity follows the blur (a fade layer, render/layers.ts). The copy is the author's
 *   pre-blurred variant (`data-cv-blurred`), else the image under a static blur. A build step that
 *   generates variants can write either attribute.
 * - `duotone`: a print of each image in two inks sits over it, and the effect's tracks show the
 *   print instead of the element (a copy layer, render/layers.ts).
 *
 * Copies live in the element's shadow root after the slot, so they move with its layers and cover
 * positioned images too. Each sits on its image's content box, measured against its container, and
 * follows the image's current source (`currentSrc`), so responsive images keep their candidate.
 * A blur fades a copy's edges (it samples transparency past them). A stand-in is scaled past its
 * box to keep them opaque, as the lexicon pads its 16px stand-ins. A focus copy must line up with
 * the sharp image beneath, so a second, scaled copy fills in under its edges instead (the visual
 * comparison in gate/probes/stills.mjs).
 */
import type { Effect } from '../core/fx';
import type { Tracks } from '../core/props';
import { warn } from '../dev/warn';
import type { LayerPlan } from '../render/layers';

/** Lexicon #25: the stand-in is blurred by 3.5% of its width, scaled to keep its edges opaque. */
const STANDIN = 'filter:blur(3.5cqi);transform:scale(1.15)';
const FILL = 'position:absolute;inset:0;display:block;width:100%;height:100%;max-width:none;';
/** Attributes that decide how the copy loads, kept the same as the image's. */
const LOADING = ['crossorigin', 'referrerpolicy', 'loading', 'decoding'];

interface Copy<C extends HTMLElement = HTMLImageElement> {
  img: HTMLImageElement;
  box: HTMLElement;
  /** The copy of the image; a print's light ink. */
  copy: C;
  /** The author's variant, which replaces the image's own source. */
  variant: string | null;
  /** A scaled copy under the copy's blurred edges (a focus copy's static blur). */
  filler: HTMLImageElement | null;
  /** The static blur (px) of a copy with a filler. */
  blur: number;
}

/** The images whose copies an element shows: its own, outside nested elements' shadow roots. */
const imagesOf = (host: Element): HTMLImageElement[] => [...host.querySelectorAll('img')];

/**
 * Whether a blur on this element can fade a copy instead (F12): images only (no text, video,
 * canvas or SVG to blur with them) on more than a quarter of the viewport.
 */
function isLargePicture(host: HTMLElement): boolean {
  if (!host.querySelector('img') || host.querySelector('video, canvas, svg, iframe, object, embed'))
    return false;
  if (host.textContent?.trim()) return false;
  return host.offsetWidth * host.offsetHeight > (innerWidth * innerHeight) / 4;
}

/**
 * An effect without its blur track, and the blur track alone (F12: a large picture fades a blurred
 * copy instead of animating `filter`); null for a side with no tracks.
 */
export function splitBlur(e: Effect): [Effect | null, Effect | null] {
  const blur = e.tracks.blur;
  if (!blur) return [e, null];
  const tracks: Tracks = { ...e.tracks };
  delete tracks.blur;
  const entries = e.entries.filter(([p]) => p !== 'blur');
  return [
    entries.length || e.vars.length ? { ...e, tracks, entries } : null,
    { ...e, tracks: { blur }, entries: [['blur', blur[0], blur[1]]], vars: [] },
  ];
}

/** F12: the blur of one layer, shown as the opacity of a blurred copy. */
export interface FadePlan {
  layer: LayerPlan;
  /** The most the layer blurs (px). */
  blur: number;
}

/**
 * F12: on a large picture, each shadow layer's blur moves to a fade layer over a blurred copy;
 * the layer keeps its other tracks. Stagger targets and split pieces keep their blur.
 */
export function planFades(layers: LayerPlan[], host: HTMLElement): FadePlan[] {
  const blurs = (l: LayerPlan): boolean =>
    l.select === 'rest' && [...l.effects, ...l.exitEffects].some((e) => e.tracks.blur);
  if (!layers.some(blurs) || !isLargePicture(host)) return [];
  const parts = (list: Effect[]): [Effect[], Effect[]] => {
    const split = list.map(splitBlur);
    return [
      split.map(([rest]) => rest).filter((e): e is Effect => e !== null),
      split.map(([, blur]) => blur).filter((e): e is Effect => e !== null),
    ];
  };
  const fades: FadePlan[] = [];
  layers.forEach((l, i) => {
    if (!blurs(l)) return;
    const [effects, blurEffects] = parts(l.effects);
    const [exitEffects, blurExits] = parts(l.exitEffects);
    layers[i] = { ...l, effects, exitEffects };
    const blur = Math.max(
      ...[...blurEffects, ...blurExits].flatMap((e) =>
        e.entries.map(([, a, b]) => Math.max(+a, +b))
      )
    );
    if (blur > 0) {
      fades.push({ layer: { ...l, effects: blurEffects, exitEffects: blurExits }, blur });
    }
  });
  return fades;
}

/** The inks of one layer: its duotone effects, shown as a print over the images (lexicon #27). */
export interface InkPlan {
  layer: LayerPlan;
  inks: readonly [string, string];
}

/**
 * Each shadow layer's duotone effects move to an ink plan of their own (the print's layer); the
 * layer keeps its other effects.
 */
export function planInks(layers: LayerPlan[]): InkPlan[] {
  const plans: InkPlan[] = [];
  const inked = (e: Effect): boolean => e.inks !== null;
  layers.forEach((l, i) => {
    const first = [...l.effects, ...l.exitEffects].find(inked);
    if (l.select !== 'rest' || !first) return;
    const without = (list: Effect[]): Effect[] => list.filter((e) => !inked(e));
    layers[i] = { ...l, effects: without(l.effects), exitEffects: without(l.exitEffects) };
    plans.push({
      layer: { ...l, effects: l.effects.filter(inked), exitEffects: l.exitEffects.filter(inked) },
      inks: first.inks!,
    });
  });
  return plans;
}

/** A layer-sized container for copies, after everything else in the innermost layer. */
export function copyContainer(slot: HTMLSlotElement, part: string): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('part', part);
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  slot.parentNode!.append(el);
  return el;
}

class Copies<C extends HTMLElement = HTMLImageElement> {
  protected items: Array<Copy<C>> = [];
  private resize: ResizeObserver | null = null;
  protected cleanups: Array<() => void> = [];

  constructor(
    readonly host: HTMLElement,
    readonly container: HTMLElement
  ) {}

  /** A copy of `img`, or null when there is nothing to copy yet (an unpicked <picture>). */
  protected add(
    this: Copies,
    img: HTMLImageElement,
    variant: string | null,
    look: string,
    blur = 0
  ): Copy | null {
    const copy = document.createElement('img');
    copy.alt = '';
    for (const name of LOADING) {
      const value = img.getAttribute(name);
      if (value !== null) copy.setAttribute(name, value);
    }
    if (!source(copy, img, variant)) return null;
    const box = document.createElement('div');
    box.style.cssText = 'position:absolute;overflow:clip;container-type:inline-size';
    copy.style.cssText = FILL + look;
    const filler = blur ? (copy.cloneNode() as HTMLImageElement) : null;
    if (filler) box.append(filler);
    box.append(copy);
    const item = { img, box, copy, variant, filler, blur };
    this.hold(item);
    return item;
  }

  /** Show a copy, placed by measure(). */
  protected hold(item: Copy<C>): void {
    this.container.append(item.box);
    this.items.push(item);
    this.resize?.observe(item.img);
  }

  /** Place the copies now and whenever an image or the element changes size. */
  protected watch(): void {
    this.measure();
    this.resize = new ResizeObserver(() => this.measure());
    this.resize.observe(this.host);
    for (const { img } of this.items) this.resize.observe(img);
  }

  /** Put each box on its image's content box, in the container's untransformed pixels. */
  measure(): void {
    if (!this.items.length) return;
    // The container shares the layers' transforms with the images: undo their scale.
    const c = this.container.getBoundingClientRect();
    // offsetWidth/Height round fractional layout pixels and would mistake that rounding for scale.
    const style = getComputedStyle(this.container);
    const borderBox = style.boxSizing === 'border-box';
    const width =
      px(style.width) +
      (borderBox
        ? 0
        : px(style.paddingLeft) +
          px(style.paddingRight) +
          px(style.borderLeftWidth) +
          px(style.borderRightWidth));
    const height =
      px(style.height) +
      (borderBox
        ? 0
        : px(style.paddingTop) +
          px(style.paddingBottom) +
          px(style.borderTopWidth) +
          px(style.borderBottomWidth));
    const sx = width ? c.width / width : 1;
    const sy = height ? c.height / height : 1;
    const reads = this.items.map(({ img }) => ({
      r: img.getBoundingClientRect(),
      s: getComputedStyle(img),
    }));
    this.items.forEach((item, i) => {
      const { r, s } = reads[i]!;
      const left = px(s.borderLeftWidth) + px(s.paddingLeft);
      const top = px(s.borderTopWidth) + px(s.paddingTop);
      const width = Math.max(0, r.width / sx - left - px(s.borderRightWidth) - px(s.paddingRight));
      const height = Math.max(
        0,
        r.height / sy - top - px(s.borderBottomWidth) - px(s.paddingBottom)
      );
      const box = item.box.style;
      box.left = `${(r.left - c.left) / sx + left}px`;
      box.top = `${(r.top - c.top) / sy + top}px`;
      box.width = `${width}px`;
      box.height = `${height}px`;
      box.borderRadius = s.borderRadius;
      this.fit(item, s, width, height);
    });
  }

  /** Lay the copy out in its box as the image is in its own (`s`: the image's computed style). */
  protected fit(item: Copy<C>, s: CSSStyleDeclaration, width: number, height: number): void {
    for (const el of [item.copy, item.filler]) {
      if (!el) continue;
      el.style.objectFit = s.objectFit;
      el.style.objectPosition = s.objectPosition;
    }
    const scale = 1 + (4 * item.blur) / Math.max(1, Math.min(width, height));
    if (item.filler) item.filler.style.transform = `scale(${scale})`;
  }

  protected drop(item: Copy<C>): void {
    const i = this.items.indexOf(item);
    if (i < 0) return;
    this.items.splice(i, 1);
    item.box.remove();
    this.resize?.unobserve(item.img);
  }

  destroy(): void {
    this.resize?.disconnect();
    this.resize = null;
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups = [];
    this.items = [];
    this.container.remove();
  }
}

/**
 * Point the copy at the variant, else the image's current source (or its candidates, before one is
 * picked). False when there is nothing to point at yet.
 */
function source(copy: HTMLImageElement, img: HTMLImageElement, variant: string | null): boolean {
  const own = img.getAttribute('src');
  if (variant) copy.src = variant;
  else if (img.currentSrc) copy.src = img.currentSrc;
  // In a <picture> the sources pick: the copy would fetch a candidate the image may not use.
  else if (img.parentElement instanceof HTMLPictureElement || (!img.srcset && !own)) return false;
  else {
    if (img.srcset) {
      copy.sizes = img.sizes;
      copy.srcset = img.srcset;
    }
    if (own !== null) copy.src = own;
  }
  return true;
}

const px = (value: string): number => parseFloat(value) || 0;

/** Settles once `img` has loaded and decoded, or failed; true when it can be shown. */
function arrival(img: HTMLImageElement, signal: { stop: boolean }): Promise<boolean> {
  const decoded = (): Promise<boolean> =>
    img.decode().then(
      () => true,
      // decode() can reject for an image that shows fine (an SVG, a detached decode).
      () => img.complete && img.naturalWidth > 0
    );
  if (img.complete) return decoded();
  return new Promise<void>((resolve) => {
    const done = (): void => {
      img.removeEventListener('load', done);
      img.removeEventListener('error', done);
      resolve();
    };
    img.addEventListener('load', done);
    img.addEventListener('error', done);
  }).then(() => (signal.stop ? false : decoded()));
}

/** `develop`: stand-ins over the images that have not arrived, until they have (lexicon #25). */
export class Develop extends Copies {
  private signal = { stop: false };

  /** `duration`, `easing`: the crossfade once an image arrives (ms, CSS). */
  mount(duration: number, easing: string): void {
    for (const img of imagesOf(this.host)) {
      // Already here (cached, or arrived before the build): nothing to develop.
      if (img.complete) continue;
      const item = this.add(img, img.getAttribute('data-cv-standin'), STANDIN);
      if (!item) continue;
      const signal = this.signal;
      // Wait for the stand-in too when it is the image itself, so the fade never starts on a blank.
      void Promise.all([
        arrival(img, signal),
        item.variant ? true : arrival(item.copy, signal),
      ]).then(([shown]) => {
        if (signal.stop || !this.items.includes(item)) return;
        if (!shown) {
          if (__DEV__) warn(img, `develop: ${img.currentSrc || img.src} did not load`);
          // The author's stand-in keeps the place; a copy of a broken image shows nothing.
          if (!item.variant) this.drop(item);
          return;
        }
        const fade = item.box.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration,
          easing,
          fill: 'forwards',
        });
        void fade.finished.then(
          () => this.drop(item),
          () => undefined
        );
        this.cleanups.push(() => fade.cancel());
      });
    }
    if (this.items.length) this.watch();
    else this.container.remove();
  }

  override destroy(): void {
    this.signal.stop = true;
    super.destroy();
  }
}

const MASK = 'mask-repeat:no-repeat;';

/** A URL in CSS `url()` (JSON's quoting reads the same in CSS). */
const cssUrl = (src: string): string => `url(${JSON.stringify(src)})`;

/**
 * Whether a mask can read the image. Masks are fetched in CORS mode: an image from another origin
 * needs `crossorigin` (and its server's consent). data: and blob: images are the page's own.
 */
function maskable(img: HTMLImageElement, src: string): boolean {
  if (img.crossOrigin !== null || /^(data|blob):/.test(src)) return true;
  return new URL(src, location.href).origin === location.origin;
}

/**
 * `duotone` (lexicon #27): each image printed in two inks, over its content box. The dark ink is
 * the ground and the light ink shows through a mask made of the image's luminance, so a pixel of
 * brightness v prints dark + v × (light − dark); the image's alpha masks both, so what is
 * transparent stays so. The masks lie as the image does (object-fit, object-position) and follow
 * its current source once it has loaded; until then the image shows as it is.
 */
export class Duotone extends Copies<HTMLElement> {
  mount([dark, light]: readonly [string, string]): void {
    let foreign = false;
    for (const img of imagesOf(this.host)) {
      let item: Copy<HTMLElement> | null = null;
      const print = (): void => {
        const src = img.currentSrc;
        if (!src || !img.naturalWidth) return;
        if (!maskable(img, src)) {
          if (__DEV__ && !foreign) {
            warn(img, `duotone: ${src} is from another origin; add crossorigin to print it`);
          }
          foreign = true;
          return;
        }
        if (!item) {
          const box = document.createElement('div');
          box.style.cssText = `position:absolute;overflow:clip;background:${dark};${MASK}mask-mode:alpha`;
          const ink = document.createElement('div');
          ink.style.cssText = `position:absolute;inset:0;background:${light};${MASK}mask-mode:luminance`;
          box.append(ink);
          item = { img, box, copy: ink, variant: null, filler: null, blur: 0 };
          this.hold(item);
        }
        for (const el of [item.box, item.copy]) el.style.setProperty('mask-image', cssUrl(src));
        this.measure();
      };
      print();
      // Loaded later, or a new candidate (a resize, a <picture> source): the print follows.
      img.addEventListener('load', print);
      this.cleanups.push(() => img.removeEventListener('load', print));
    }
    this.watch();
  }

  /** The masks take the image's object-fit as their size and its object-position. */
  protected override fit(
    item: Copy<HTMLElement>,
    s: CSSStyleDeclaration,
    width: number,
    height: number
  ): void {
    const { naturalWidth: w, naturalHeight: h } = item.img;
    const natural = `${w}px ${h}px`;
    const fit = s.objectFit;
    const size =
      fit === 'cover' || fit === 'contain'
        ? fit
        : fit === 'none'
          ? natural
          : fit === 'scale-down'
            ? w > width || h > height
              ? 'contain'
              : natural
            : '100% 100%';
    for (const el of [item.box, item.copy]) {
      el.style.setProperty('mask-size', size);
      el.style.setProperty('mask-position', s.objectPosition);
    }
  }
}

/** Blurred copies over a large picture; a fade layer on the container shows the blur (F12). */
export class FocusCopy extends Copies {
  /** `blur`: the most the effects blur (px); the copy is blurred this much, once. */
  mount(blur: number): void {
    for (const img of imagesOf(this.host)) {
      const variant = img.getAttribute('data-cv-blurred');
      const make = (): Copy | null =>
        variant ? this.add(img, variant, '') : this.add(img, null, `filter:blur(${blur}px)`, blur);
      make();
      // A new candidate (a resize, a <picture> source) or a first one: the copy follows it.
      const follow = (): void => {
        const item = this.items.find((c) => c.img === img) ?? make();
        if (item && !variant && img.currentSrc && item.copy.src !== img.currentSrc) {
          for (const el of [item.copy, item.filler]) {
            el?.removeAttribute('srcset');
            if (el) el.src = img.currentSrc;
          }
        }
        this.measure();
      };
      img.addEventListener('load', follow);
      this.cleanups.push(() => img.removeEventListener('load', follow));
    }
    this.watch();
  }
}
