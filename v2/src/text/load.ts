/**
 * Split text is a chunk of its own (plan v3 §11: the initial bundle is core, scroll input and the
 * first presets). The stage loads it before a build that has a `split` element; elements read it
 * synchronously while building.
 */
type SplitModule = typeof import('./split');

let loaded: SplitModule | null = null;
let loading: Promise<SplitModule> | null = null;

export function loadSplit(): Promise<SplitModule> {
  return (loading ??= import('./split').then((m) => (loaded = m)));
}

/** The module once loaded; null before. */
export const splitModule = (): SplitModule | null => loaded;
