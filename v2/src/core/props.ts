/**
 * Animatable properties: the value model, how values of one progress source combine, and the CSS
 * written for a frame.
 *
 * Within one layer (one progress source) translate, rotate, skew and blur add; scale and opacity
 * multiply; clip has a single owner. Across layers the browser composes: nested transforms,
 * multiplied opacity, stacked filters, intersected clips (plan v3 §4.1).
 */

export type Prop =
  | 'x' // translate, px
  | 'y'
  | 'xp' // translate, % of the element
  | 'yp'
  | 'scale'
  | 'sx'
  | 'sy'
  | 'rotate' // deg
  | 'rx' // rotateX, deg (layer `transform`, with perspective)
  | 'ry'
  | 'skx' // skew, deg (layer `transform`)
  | 'sky'
  | 'opacity'
  | 'blur' // px
  | 'clip'; // inset [top, right, bottom, left] in %

export type Clip = readonly [number, number, number, number];
export type Value = number | Clip;
export type Tracks = Partial<Record<Prop, readonly [Value, Value]>>;

export interface Frame {
  x: number;
  y: number;
  xp: number;
  yp: number;
  scale: number;
  sx: number;
  sy: number;
  rotate: number;
  rx: number;
  ry: number;
  skx: number;
  sky: number;
  opacity: number;
  blur: number;
  clip: Clip | null;
}

type NumericProp = Exclude<Prop, 'clip'>;

export const IDENTITY: Readonly<Record<NumericProp, number>> = {
  x: 0,
  y: 0,
  xp: 0,
  yp: 0,
  scale: 1,
  sx: 1,
  sy: 1,
  rotate: 0,
  rx: 0,
  ry: 0,
  skx: 0,
  sky: 0,
  opacity: 1,
  blur: 0,
};
export const NO_CLIP: Clip = [0, 0, 0, 0];

export const identityFrame = (): Frame => ({ ...IDENTITY, clip: null });

// Per-frame paths (direct writes run these per layer per frame): named fields, no keyed access.
// Additive: x y xp yp rotate rx ry skx sky blur; multiplicative: scale sx sy opacity.
export function resetFrame(frame: Frame): void {
  frame.x = frame.y = frame.xp = frame.yp = 0;
  frame.rotate = frame.rx = frame.ry = frame.skx = frame.sky = frame.blur = 0;
  frame.scale = frame.sx = frame.sy = frame.opacity = 1;
  frame.clip = null;
}

/** Fold b into a (same-source composition). */
export function combine(a: Frame, b: Frame): void {
  a.x += b.x;
  a.y += b.y;
  a.xp += b.xp;
  a.yp += b.yp;
  a.rotate += b.rotate;
  a.rx += b.rx;
  a.ry += b.ry;
  a.skx += b.skx;
  a.sky += b.sky;
  a.blur += b.blur;
  a.scale *= b.scale;
  a.sx *= b.sx;
  a.sy *= b.sy;
  a.opacity *= b.opacity;
  if (b.clip) a.clip = b.clip;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Apply one track at eased progress t, composing into `frame`. */
export function applyTrack(frame: Frame, prop: Prop, from: Value, to: Value, t: number): void {
  if (prop === 'clip') {
    const f = from as Clip;
    const g = to as Clip;
    frame.clip = [
      lerp(f[0], g[0], t),
      lerp(f[1], g[1], t),
      lerp(f[2], g[2], t),
      lerp(f[3], g[3], t),
    ];
    return;
  }
  const v = lerp(from as number, to as number, t);
  switch (prop) {
    case 'scale':
      frame.scale *= v;
      break;
    case 'sx':
      frame.sx *= v;
      break;
    case 'sy':
      frame.sy *= v;
      break;
    case 'opacity':
      frame.opacity *= v;
      break;
    case 'x':
      frame.x += v;
      break;
    case 'y':
      frame.y += v;
      break;
    case 'xp':
      frame.xp += v;
      break;
    case 'yp':
      frame.yp += v;
      break;
    case 'rotate':
      frame.rotate += v;
      break;
    case 'rx':
      frame.rx += v;
      break;
    case 'ry':
      frame.ry += v;
      break;
    case 'skx':
      frame.skx += v;
      break;
    case 'sky':
      frame.sky += v;
      break;
    case 'blur':
      frame.blur += v;
      break;
  }
}

/** Properties the compositor can animate (Chrome, Safari 26.4+). Blur and clip-path repaint. */
const MAIN_THREAD: ReadonlySet<Prop> = new Set<Prop>(['blur', 'clip']);
export const compositorEligible = (used: ReadonlySet<Prop>): boolean => {
  for (const p of used) if (MAIN_THREAD.has(p)) return false;
  return true;
};

/** Perspective written into the layer transform for rotateX/Y (plan v3 §4.2: not the author's parent). */
const PERSPECTIVE = 1000;

const fmt = (n: number): string => String(Math.round(n * 1e4) / 1e4);
const length = (px: number, pct: number): string =>
  pct ? (px ? `calc(${fmt(px)}px + ${fmt(pct)}%)` : `${fmt(pct)}%`) : `${fmt(px)}px`;

/** CSS for a frame. Only properties in `used` are emitted, so other author styles are left alone. */
export function frameCss(frame: Frame, used: ReadonlySet<Prop>): Record<string, string> {
  const css: Record<string, string> = {};
  if (used.has('x') || used.has('y') || used.has('xp') || used.has('yp')) {
    css.translate = `${length(frame.x, frame.xp)} ${length(frame.y, frame.yp)}`;
  }
  if (used.has('scale') || used.has('sx') || used.has('sy')) {
    const sx = frame.scale * frame.sx;
    const sy = frame.scale * frame.sy;
    css.scale = sx === sy ? fmt(sx) : `${fmt(sx)} ${fmt(sy)}`;
  }
  if (used.has('rotate')) css.rotate = `${fmt(frame.rotate)}deg`;
  if (used.has('rx') || used.has('ry') || used.has('skx') || used.has('sky')) {
    const parts: string[] = [];
    if (used.has('rx') || used.has('ry')) {
      parts.push(`perspective(${PERSPECTIVE}px)`);
      if (used.has('rx')) parts.push(`rotateX(${fmt(frame.rx)}deg)`);
      if (used.has('ry')) parts.push(`rotateY(${fmt(frame.ry)}deg)`);
    }
    if (used.has('skx') || used.has('sky'))
      parts.push(`skew(${fmt(frame.skx)}deg, ${fmt(frame.sky)}deg)`);
    css.transform = parts.join(' ');
  }
  if (used.has('opacity')) css.opacity = fmt(frame.opacity);
  if (used.has('blur')) css.filter = `blur(${fmt(frame.blur)}px)`;
  if (used.has('clip')) {
    const [t, r, b, l] = frame.clip ?? NO_CLIP;
    css.clipPath = `inset(${fmt(t)}% ${fmt(r)}% ${fmt(b)}% ${fmt(l)}%)`;
  }
  return css;
}

// ---- raw declarations: from="opacity:.2; y:40; scale:.9" -------------------------------------------

const KEYS: Readonly<Record<string, Prop>> = {
  opacity: 'opacity',
  x: 'x',
  y: 'y',
  scale: 'scale',
  scalex: 'sx',
  scaley: 'sy',
  rotate: 'rotate',
  rotatex: 'rx',
  rotatey: 'ry',
  skewx: 'skx',
  skewy: 'sky',
  blur: 'blur',
  clip: 'clip',
};

const ANGLE: Readonly<Record<string, number>> = { '': 1, deg: 1, turn: 360, rad: 180 / Math.PI };

/** Parse an inset: `inset(0 100% 0 0)` or bare 1–4 percentages, CSS shorthand order. */
export function parseInset(text: string): Clip | null {
  const body = /^inset\((.*)\)$/.exec(text.trim())?.[1] ?? text;
  const values = body
    .trim()
    .split(/\s+/)
    .map((v) => (/^-?\d*\.?\d+%?$/.test(v) ? Number.parseFloat(v) : Number.NaN));
  if (!values.length || values.length > 4 || values.some((v) => !Number.isFinite(v))) return null;
  const [t, r = t, b = t, l = r] = values as [number, number?, number?, number?];
  return [t, r, b, l];
}

/**
 * `opacity:.2; y:40; y:100%; scale-x:.4; rotate:.5turn; blur:6; clip:inset(0 100% 0 0)`.
 * Keys are case-insensitive, kebab or camel. Unknown keys and units are reported and skipped.
 */
export function parseDeclarations(
  text: string | null,
  report: (message: string) => void
): Partial<Record<Prop, Value>> {
  const out: Partial<Record<Prop, Value>> = {};
  if (!text) return out;
  for (const pair of text.split(';')) {
    if (!pair.trim()) continue;
    const colon = pair.indexOf(':');
    const key = colon < 0 ? '' : pair.slice(0, colon).trim().toLowerCase().replace(/-/g, '');
    const raw = colon < 0 ? '' : pair.slice(colon + 1).trim();
    const prop = KEYS[key];
    if (!prop || !raw) {
      report(
        `Cannot read "${pair.trim()}": expected one of ${Object.keys(KEYS).join(', ')} with a value`
      );
      continue;
    }
    if (prop === 'clip') {
      const inset = parseInset(raw);
      if (inset) out.clip = inset;
      else report(`Cannot read clip value "${raw}"; use inset(top right bottom left) in %`);
      continue;
    }
    const m = /^(-?\d*\.?\d+)([a-z%]*)$/i.exec(raw);
    if (!m) {
      report(`Cannot read ${key} value "${raw}"`);
      continue;
    }
    const n = Number(m[1]);
    const unit = m[2]!.toLowerCase();
    if (prop === 'x' || prop === 'y') {
      if (unit === '%') out[prop === 'x' ? 'xp' : 'yp'] = n;
      else if (unit === '' || unit === 'px') out[prop] = n;
      else report(`${key} accepts px or %, not "${unit}"`);
    } else if (
      prop === 'rotate' ||
      prop === 'rx' ||
      prop === 'ry' ||
      prop === 'skx' ||
      prop === 'sky'
    ) {
      const k = ANGLE[unit];
      if (k === undefined) report(`${key} accepts deg, turn or rad, not "${unit}"`);
      else out[prop] = n * k;
    } else if (prop === 'blur') {
      if (unit === '' || unit === 'px') out.blur = Math.max(0, n);
      else report(`blur accepts px, not "${unit}"`);
    } else if (unit === '%') {
      out[prop] = n / 100;
    } else if (unit === '') {
      out[prop] = n;
    } else {
      report(`${key} takes a number, not "${unit}"`);
    }
  }
  return out;
}

/** Tracks from a from-state and a to-state; a side that is missing a property uses the identity. */
export function tracksBetween(
  from: Partial<Record<Prop, Value>>,
  to: Partial<Record<Prop, Value>>
): Tracks {
  const tracks: Tracks = {};
  const keys = new Set([...Object.keys(from), ...Object.keys(to)] as Prop[]);
  for (const p of keys) {
    const identity: Value = p === 'clip' ? NO_CLIP : IDENTITY[p];
    tracks[p] = [from[p] ?? identity, to[p] ?? identity];
  }
  return tracks;
}
