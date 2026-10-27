/**
 * Count wheels are a chunk of their own (plan v3 §11), like split text. The stage loads it before
 * a build that has a `count`; elements read it synchronously while building.
 */
type CountModule = typeof import('./count');

let loaded: CountModule | null = null;
let loading: Promise<CountModule> | null = null;

export function loadCount(): Promise<CountModule> {
  return (loading ??= import('./count').then((m) => (loaded = m)));
}

/** The module once loaded; null before. */
export const countModule = (): CountModule | null => loaded;

/** Whether an element may need it: `count` among its effects. */
export const usesCount = (el: Element): boolean =>
  /\bcount\b/.test(`${el.getAttribute('fx') ?? ''} ${el.getAttribute('exit') ?? ''}`);
