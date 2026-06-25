import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ExperienceHub } from './pages/ExperienceHub';
import { MODE_ROUTES, buildModeHref, parseHashRoute } from './routing';

describe('performance-test routing shell', () => {
  it('resolves known hash routes and falls back to home', () => {
    expect(parseHashRoute('')).toBe('home');
    expect(parseHashRoute('#/legacy')).toBe('home');
    expect(parseHashRoute('#/drag')).toBe('drag');
    expect(parseHashRoute('#/scroll')).toBe('scroll');
    expect(parseHashRoute('#/panda')).toBe('panda');
    expect(parseHashRoute('#/panda-pro')).toBe('panda-pro');
    expect(parseHashRoute('#/unknown')).toBe('home');
  });

  it('exposes exactly the three curated mode routes', () => {
    expect(MODE_ROUTES.map((route) => route.id)).toEqual(['drag', 'scroll', 'panda-pro']);
    expect(MODE_ROUTES.map((route) => buildModeHref(route.id))).toEqual([
      '#/drag',
      '#/scroll',
      '#/panda-pro',
    ]);
  });

  it('renders the hub with links for all mode pages', () => {
    const markup = renderToStaticMarkup(<ExperienceHub />);

    expect(markup).toContain('Orbit S1');
    expect(markup).toContain('Motion mode');
    expect(markup).toContain('#/drag');
    expect(markup).toContain('#/scroll');
    expect(markup).toContain('#/panda-pro');
  });
});
