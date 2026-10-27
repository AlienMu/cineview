/**
 * Still pictures are a chunk of their own (plan v3 §11), like split text. The stage loads it
 * before a build that may use it; elements read it synchronously while building, and without it
 * (a custom preset's blur the test below misses) a blur stays a blur.
 */
type StillsModule = typeof import('./stills');

let loaded: StillsModule | null = null;
let loading: Promise<StillsModule> | null = null;

export function loadStills(): Promise<StillsModule> {
  return (loading ??= import('./stills').then((m) => (loaded = m)));
}

/** The module once loaded; null before. */
export const stillsModule = (): StillsModule | null => loaded;

/** Whether an element may need it: images, with `develop`, `duotone` or a blur (focus, reveal, blur). */
export const usesStills = (el: Element): boolean =>
  /develop|duotone|focus|reveal|blur/.test(
    ['fx', 'from', 'to', 'exit'].map((name) => el.getAttribute(name) ?? '').join(' ')
  ) && el.querySelector('img') !== null;
