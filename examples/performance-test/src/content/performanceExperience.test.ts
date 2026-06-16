import { describe, expect, it } from 'vitest';
import { PERFORMANCE_EXPERIENCE } from './performanceExperience';

describe('performance experience content model', () => {
  it('defines the shared authored story with the required chapters', () => {
    expect(PERFORMANCE_EXPERIENCE.sections.map((section) => section.id)).toEqual([
      'hero',
      'highlights',
      'specs',
      'details',
      'scenarios',
      'cta',
    ]);
  });

  it('uses local authored media assets instead of generated scene placeholders', () => {
    const mediaSources = PERFORMANCE_EXPERIENCE.sections
      .map((section) => section.media?.src)
      .filter((src): src is string => Boolean(src));

    expect(mediaSources.length).toBeGreaterThanOrEqual(4);
    expect(mediaSources.every((src) => src.startsWith('/assets/'))).toBe(true);
  });

  it('assigns explicit scroll and drag composition styles to every chapter', () => {
    expect(
      PERFORMANCE_EXPERIENCE.sections.map((section) => ({
        id: section.id,
        scroll: section.composition.scroll.style,
        drag: section.composition.drag.style,
      }))
    ).toEqual([
      { id: 'hero', scroll: 'document-hero', drag: 'hero-stage' },
      { id: 'highlights', scroll: 'editorial-split', drag: 'control-surface' },
      { id: 'specs', scroll: 'spec-takeover', drag: 'data-wall' },
      { id: 'details', scroll: 'exploded-story', drag: 'service-ribbon' },
      { id: 'scenarios', scroll: 'scenario-takeover', drag: 'kit-constellation' },
      { id: 'cta', scroll: 'decision-appendix', drag: 'closing-brief' },
    ]);
  });

  it('declares Scene.scroll takeover only on the authored takeover chapters', () => {
    expect(
      PERFORMANCE_EXPERIENCE.sections.map((section) => ({
        id: section.id,
        takeover: section.composition.scroll.takeover?.zoneId ?? null,
      }))
    ).toEqual([
      { id: 'hero', takeover: null },
      { id: 'highlights', takeover: null },
      { id: 'specs', takeover: 'specs-takeover' },
      { id: 'details', takeover: null },
      { id: 'scenarios', takeover: 'scenarios-takeover' },
      { id: 'cta', takeover: null },
    ]);
  });
});
