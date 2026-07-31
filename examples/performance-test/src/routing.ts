export type ModeId = 'drag' | 'scroll';
export type AppRoute = 'home' | 'acceptance-drag' | 'acceptance-scroll' | ModeId;

export interface ModeRouteDefinition {
  id: ModeId;
  label: string;
  summary: string;
}

export const MODE_ROUTES: ModeRouteDefinition[] = [
  {
    id: 'drag',
    label: 'Drag',
    summary: 'Weighted release-and-settle storytelling with chapter-specific staging.',
  },
  {
    id: 'scroll',
    label: 'Scroll',
    summary: 'Real document scroll with ordinary sections and Scene.scroll takeovers.',
  },
];

export function parseHashRoute(hash: string): AppRoute {
  const normalized = hash.replace(/^#/, '').replace(/\/+$/, '');

  if (normalized === '/drag') return 'drag';
  if (normalized === '/scroll') return 'scroll';
  if (normalized === '/acceptance/drag') return 'acceptance-drag';
  if (normalized === '/acceptance/scroll') return 'acceptance-scroll';

  return 'home';
}

export function buildModeHref(mode: ModeId): `#/${ModeId}` {
  return `#/${mode}`;
}
