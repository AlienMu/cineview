/**
 * Reading @keyframes rules is a chunk of its own (plan v3 §11), like split text. The stage loads it
 * before a build that has a `keyframes()`; elements read it synchronously while building.
 */
type KeyframesModule = typeof import('./keyframes');

let loaded: KeyframesModule | null = null;
let loading: Promise<KeyframesModule> | null = null;

export function loadKeyframes(): Promise<KeyframesModule> {
  return (loading ??= import('./keyframes').then((m) => (loaded = m)));
}

/** The module once loaded; null before. */
export const keyframesModule = (): KeyframesModule | null => loaded;

/** Whether an element may need it: `keyframes(…)` among its effects. */
export const usesKeyframes = (el: Element): boolean =>
  /\bkeyframes\s*\(/.test(el.getAttribute('fx') ?? '');
