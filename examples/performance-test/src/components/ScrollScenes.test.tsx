import { isValidElement } from 'react';
import { describe, expect, it } from 'vitest';
import { PERFORMANCE_EXPERIENCE } from '../content/performanceExperience';
import { renderScrollScenes } from './ScrollScenes';

describe('renderScrollScenes', () => {
  it('binds Scene.scroll only for sections with authored takeover config', () => {
    const scenes = renderScrollScenes(PERFORMANCE_EXPERIENCE.sections);

    expect(scenes[0]?.props.scroll).toBeUndefined();
    expect(scenes[1]?.props.scroll).toBeUndefined();
    expect(scenes[2]?.props.scroll).toMatchObject({
      trigger: 'center-lock',
      zoneId: 'specs-takeover',
    });
    expect(scenes[3]?.props.scroll).toBeUndefined();
    expect(scenes[4]?.props.scroll).toMatchObject({
      trigger: 'center-lock',
      zoneId: 'scenarios-takeover',
    });
    expect(scenes[5]?.props.scroll).toBeUndefined();
  });

  it('includes a plain document-flow block with visibility Animate outside Scene', () => {
    const scenes = renderScrollScenes(PERFORMANCE_EXPERIENCE.sections);
    const ordinaryBlock = scenes[scenes.length - 1];

    expect(ordinaryBlock?.type).toBe('article');
    expect(ordinaryBlock?.props['data-testid']).toBe('ordinary-document-interlude');
    expect(ordinaryBlock?.props.style.paddingBottom).toBe('max(560px, 64vh)');

    const animate = findAnimateById(ordinaryBlock, 'ordinary-document-visibility');
    expect(animate?.props.exitAnimation).toBe('fade-out');
    expect(animate?.props.infiniteAnimation).toBe('pulse');
    expect(animate?.props.timeline).toEqual({ driver: 'visibility' });
  });

  it('configures ordinary visibility scenes with visible infinite motion on media or metrics', () => {
    const scenes = renderScrollScenes(PERFORMANCE_EXPERIENCE.sections);

    for (const expectation of VISIBILITY_INFINITE_EXPECTATIONS) {
      const authoredScene = renderAuthoredTakeoverScene(
        scenes,
        expectation.sectionId,
        expectation.componentName
      );

      expect(findAnimateById(authoredScene, expectation.animateId)?.props).toMatchObject({
        infiniteAnimation: expectation.infiniteAnimation,
        timeline: { driver: 'visibility' },
      });
    }
  });

  it('authors takeover shared title and pill content as a single phase-owned layer', () => {
    const scenes = renderScrollScenes(PERFORMANCE_EXPERIENCE.sections);

    for (const expectation of TAKEOVER_SCENE_EXPECTATIONS) {
      const authoredTakeover = renderAuthoredTakeoverScene(
        scenes,
        expectation.sectionId,
        expectation.componentName
      );
      const replayWrappers = findElementsByTypeName(authoredTakeover, 'TakeoverReplayAnimate');
      const animateIds = findElementsByAnimateId(authoredTakeover).map(
        (animate) => animate.props.animateId
      );

      expect(replayWrappers).toHaveLength(0);
      expect(animateIds.filter((animateId) => animateId.endsWith('-pre-anchor'))).toEqual([]);

      for (const replayLayer of expectation.replayLayers) {
        expect(findAnimateById(authoredTakeover, replayLayer.takeoverAnimateId)?.props.timeline).toEqual({
          phase: replayLayer.phase,
        });
      }
    }
  });

  it('keeps replay-sensitive takeover layers off visibility-only sticky motion once Scene.scroll takes over', () => {
    const scenes = renderScrollScenes(PERFORMANCE_EXPERIENCE.sections);

    for (const expectation of TAKEOVER_SCENE_EXPECTATIONS) {
      const authoredTakeover = renderAuthoredTakeoverScene(
        scenes,
        expectation.sectionId,
        expectation.componentName
      );
      const animateTimelines = new Map(
        findElementsByAnimateId(authoredTakeover).map((animate) => [
          animate.props.animateId,
          animate.props.timeline,
        ])
      );

      expect([...animateTimelines.keys()].sort()).toEqual(
        [...Object.keys(expectation.timelinesByAnimateId)].sort()
      );

      for (const [animateId, timeline] of Object.entries(expectation.timelinesByAnimateId)) {
        expect(animateTimelines.get(animateId)).toEqual(timeline);
      }
    }
  });

  it('renders exactly one authored title/copy Animate for takeover scenes', () => {
    const scenes = renderScrollScenes(PERFORMANCE_EXPERIENCE.sections);

    for (const expectation of TAKEOVER_SCENE_EXPECTATIONS) {
      const authoredTakeover = renderAuthoredTakeoverScene(
        scenes,
        expectation.sectionId,
        expectation.componentName
      );

      for (const replayLayer of expectation.replayLayers) {
        const matchingIds = findElementsByAnimateId(authoredTakeover).filter(
          (animate) =>
            animate.props.animateId === replayLayer.takeoverAnimateId ||
            animate.props.animateId === `${replayLayer.takeoverAnimateId}-pre-anchor`
        );

        expect(matchingIds.map((animate) => animate.props.animateId)).toEqual([
          replayLayer.takeoverAnimateId,
        ]);
      }
    }
  });

  it('starts takeover title/copy phase at the anchor so the single owner can replay on reverse re-entry', () => {
    const scenes = renderScrollScenes(PERFORMANCE_EXPERIENCE.sections);

    for (const expectation of TAKEOVER_SCENE_EXPECTATIONS) {
      const authoredTakeover = renderAuthoredTakeoverScene(
        scenes,
        expectation.sectionId,
        expectation.componentName
      );

      for (const takeoverAnimateId of expectation.replayLayers.map(
        (replayLayer) => replayLayer.takeoverAnimateId
      )) {
        expect(findAnimateById(authoredTakeover, takeoverAnimateId)?.props.timeline.phase.start).toBe(0);
      }
    }
  });

  it('gives spec takeover phase layers explicit exit motion so forward scroll can leave continuously', () => {
    const scenes = renderScrollScenes(PERFORMANCE_EXPERIENCE.sections);
    const authoredTakeover = renderAuthoredTakeoverScene(scenes, 'specs', 'SpecTakeover');

    expect(findAnimateById(authoredTakeover, 'specs-pill')?.props.exitAnimation).toBe('fade-out');
    expect(findAnimateById(authoredTakeover, 'specs-copy')?.props.exitAnimation).toBe('slide-up');
    expect(findAnimateById(authoredTakeover, 'specs-stats')?.props.exitAnimation).toBe('fade-out');
    expect(findAnimateById(authoredTakeover, 'specs-media')?.props.exitAnimation).toBe(
      'rotate-out'
    );
    expect(findAnimateById(authoredTakeover, 'specs-bullets')?.props.exitAnimation).toBe(
      'blur-out'
    );
  });

  it('gives standalone visibility chapters explicit exit motion so later takeover scenes do not abruptly hide them', () => {
    const scenes = renderScrollScenes(PERFORMANCE_EXPERIENCE.sections);
    const hero = renderAuthoredTakeoverScene(scenes, 'hero', 'DocumentHero');
    const highlights = renderAuthoredTakeoverScene(scenes, 'highlights', 'EditorialSplit');
    const details = renderAuthoredTakeoverScene(scenes, 'details', 'ExplodedStory');
    const cta = renderAuthoredTakeoverScene(scenes, 'cta', 'DecisionAppendix');

    expect(findAnimateById(hero, 'hero-badge')?.props.exitAnimation).toBe('fade-out');
    expect(findAnimateById(hero, 'hero-copy')?.props.exitAnimation).toBe('slide-up');
    expect(findAnimateById(hero, 'hero-media')?.props.exitAnimation).toBe('zoom-out');
    expect(findAnimateById(hero, 'hero-rail')?.props.exitAnimation).toBe('fade-out');

    expect(findAnimateById(highlights, 'highlights-pill')?.props.exitAnimation).toBe('fade-out');
    expect(findAnimateById(highlights, 'highlights-copy')?.props.exitAnimation).toBe('slide-right');
    expect(findAnimateById(highlights, 'highlights-media')?.props.exitAnimation).toBe('slide-left');
    expect(findAnimateById(highlights, 'highlights-stats')?.props.exitAnimation).toBe('fade-out');
    expect(findAnimateById(highlights, 'highlights-notes')?.props.exitAnimation).toBe('blur-out');

    expect(findAnimateById(details, 'details-pill')?.props.exitAnimation).toBe('fade-out');
    expect(findAnimateById(details, 'details-copy')?.props.exitAnimation).toBe('slide-up');
    expect(findAnimateById(details, 'details-media')?.props.exitAnimation).toBe('zoom-out');
    expect(findAnimateById(details, 'details-rail')?.props.exitAnimation).toBe('fade-out');
    expect(findAnimateById(details, 'details-notes')?.props.exitAnimation).toBe('slide-up');

    expect(findAnimateById(cta, 'cta-pill')?.props.exitAnimation).toBe('fade-out');
    expect(findAnimateById(cta, 'cta-copy')?.props.exitAnimation).toBe('slide-up');
    expect(findAnimateById(cta, 'cta-grid')?.props.exitAnimation).toBe('fade-out');
    expect(findAnimateById(cta, 'cta-rail')?.props.exitAnimation).toBe('blur-out');
  });

  it('gives scenario takeover phase layers explicit exit motion so forward scroll can leave continuously', () => {
    const scenes = renderScrollScenes(PERFORMANCE_EXPERIENCE.sections);
    const authoredTakeover = renderAuthoredTakeoverScene(scenes, 'scenarios', 'ScenarioTakeover');

    expect(findAnimateById(authoredTakeover, 'scenarios-pill')?.props.exitAnimation).toBe(
      'fade-out'
    );
    expect(findAnimateById(authoredTakeover, 'scenarios-copy')?.props.exitAnimation).toBe(
      'zoom-out'
    );
    expect(findAnimateById(authoredTakeover, 'scenarios-left')?.props.exitAnimation).toBe(
      'slide-right'
    );
    expect(findAnimateById(authoredTakeover, 'scenarios-center')?.props.exitAnimation).toBe(
      'blur-out'
    );
    expect(findAnimateById(authoredTakeover, 'scenarios-right')?.props.exitAnimation).toBe(
      'slide-left'
    );
  });
});

const TAKEOVER_SCENE_EXPECTATIONS = [
  {
    sectionId: 'specs',
    zoneId: 'specs-takeover',
    componentName: 'SpecTakeover',
    replayLayers: [
      {
        takeoverAnimateId: 'specs-pill',
        phase: { start: 0, end: 0.22 },
      },
      {
        takeoverAnimateId: 'specs-copy',
        phase: { start: 0, end: 0.34 },
      },
    ],
    timelinesByAnimateId: {
      'specs-pill': { phase: { start: 0, end: 0.22 } },
      'specs-copy': { phase: { start: 0, end: 0.34 } },
      'specs-stats': { phase: { start: 0.04, end: 0.48 } },
      'specs-media': { phase: { start: 0.12, end: 0.76 } },
      'specs-bullets': { phase: { start: 0.28, end: 0.92 } },
    },
  },
  {
    sectionId: 'scenarios',
    zoneId: 'scenarios-takeover',
    componentName: 'ScenarioTakeover',
    replayLayers: [
      {
        takeoverAnimateId: 'scenarios-pill',
        phase: { start: 0, end: 0.2 },
      },
      {
        takeoverAnimateId: 'scenarios-copy',
        phase: { start: 0, end: 0.38 },
      },
    ],
    timelinesByAnimateId: {
      'scenarios-pill': { phase: { start: 0, end: 0.2 } },
      'scenarios-copy': { phase: { start: 0, end: 0.38 } },
      'scenarios-left': { phase: { start: 0.04, end: 0.46 } },
      'scenarios-center': { phase: { start: 0.12, end: 0.72 } },
      'scenarios-right': { phase: { start: 0.24, end: 0.9 } },
    },
  },
] as const;

const VISIBILITY_INFINITE_EXPECTATIONS = [
  {
    sectionId: 'hero',
    componentName: 'DocumentHero',
    animateId: 'hero-media',
    infiniteAnimation: 'pulse',
  },
  {
    sectionId: 'highlights',
    componentName: 'EditorialSplit',
    animateId: 'highlights-stats',
    infiniteAnimation: 'pulse',
  },
  {
    sectionId: 'details',
    componentName: 'ExplodedStory',
    animateId: 'details-media',
    infiniteAnimation: 'wave',
  },
  {
    sectionId: 'cta',
    componentName: 'DecisionAppendix',
    animateId: 'cta-grid',
    infiniteAnimation: 'pulse',
  },
] as const;

function renderAuthoredTakeoverScene(
  scenes: JSX.Element[],
  sectionId: string,
  componentName: string
): JSX.Element {
  const sectionIndex = PERFORMANCE_EXPERIENCE.sections.findIndex((section) => section.id === sectionId);
  const scene = scenes[sectionIndex];
  const authoredScene = findElementsByTypeName(scene, componentName)[0];

  expect(authoredScene).toBeDefined();
  expect(typeof authoredScene?.type).toBe('function');

  const render = authoredScene?.type as ((props: Record<string, unknown>) => JSX.Element) | undefined;

  expect(render).toBeDefined();

  return render?.(authoredScene?.props as Record<string, unknown>) as JSX.Element;
}

function findAnimateById(node: unknown, animateId: string) {
  return findElementsByAnimateId(node).find((animate) => animate.props.animateId === animateId) ?? null;
}

function findElementsByAnimateId(node: unknown) {
  return collectElements(node, (element) => typeof element.props.animateId === 'string');
}

function findElementsByTypeName(node: unknown, typeName: string) {
  return collectElements(node, (element) => getElementTypeName(element) === typeName);
}

function collectElements(
  node: unknown,
  predicate: (element: JSX.Element) => boolean,
  visited = new Set<object>()
): JSX.Element[] {
  if (Array.isArray(node)) {
    return node.flatMap((child) => collectElements(child, predicate, visited));
  }

  if (!node || typeof node !== 'object') {
    return [];
  }

  if (visited.has(node)) {
    return [];
  }
  visited.add(node);

  if (isValidElement(node)) {
    const matches = predicate(node) ? [node] : [];

    return matches.concat(collectElements(node.props, predicate, visited));
  }

  return Object.values(node).flatMap((value) => collectElements(value, predicate, visited));
}

function getElementTypeName(node: JSX.Element): string | null {
  if (typeof node.type === 'string') {
    return node.type;
  }

  if (typeof node.type === 'function') {
    return node.type.name || null;
  }

  return null;
}
