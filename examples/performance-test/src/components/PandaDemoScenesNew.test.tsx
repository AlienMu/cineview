import { isValidElement } from 'react';
import { describe, expect, it } from 'vitest';
import { PandaDemoScenesNew } from './PandaDemoScenesNew';

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/**
 * PandaDemoScenesNew stores direct <Scene> elements (returned by render functions).
 * No wrapping — each item is already a Scene JSX element.
 */

function findAnimateById(node: unknown, animateId: string): JSX.Element | null {
  return (
    findElementsByAnimateId(node).find((animate) => animate.props.animateId === animateId) ?? null
  );
}

function findElementsByAnimateId(node: unknown): JSX.Element[] {
  return collectElements(node, (element) => typeof element.props.animateId === 'string');
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

  if (visited.has(node as object)) {
    return [];
  }
  visited.add(node as object);

  if (isValidElement(node)) {
    const matches = predicate(node) ? [node] : [];
    return matches.concat(collectElements((node as JSX.Element).props, predicate, visited));
  }

  return Object.values(node as object).flatMap((value) =>
    collectElements(value, predicate, visited)
  );
}

// ---------------------------------------------------------------------------
// TESTS
// ---------------------------------------------------------------------------

describe('PandaDemoScenesNew', () => {
  // PandaDemoScenesNew contains direct <Scene> elements
  const scenes = PandaDemoScenesNew;

  // --- STRUCTURE ---

  it('exports exactly 7 scenes', () => {
    expect(scenes).toHaveLength(7);
  });

  it('each scene is a direct Scene element with unique key', () => {
    const keys = new Set<string>();
    for (const scene of scenes) {
      expect(isValidElement(scene)).toBe(true);
      expect(typeof scene.type).toBe('function');
      const key = scene.key as string;
      expect(key).toMatch(/^panda-\d$/);
      keys.add(key);
    }
    expect(keys.size).toBe(7);
  });

  // --- SCENE TRANSITIONS ---

  it('each scene has a unique enter/exit transition combo', () => {
    const combos = scenes.map((scene) => {
      const t = scene.props.transition;
      return `${t.enterAnimation} → ${t.exitAnimation} (${t.exitDuration}ms)`;
    });

    expect(new Set(combos).size).toBe(7);

    expect(combos[0]).toContain('slide-up');
    expect(combos[0]).toContain('fade-out');
    expect(combos[1]).toContain('blur-in');
    expect(combos[2]).toContain('zoom-in');
    expect(combos[2]).toContain('rotate-out');
    expect(combos[3]).toContain('flip-x');
    expect(combos[4]).toContain('rotate-in');
    expect(combos[5]).toContain('jack-in-the-box');
    expect(combos[6]).toContain('focus-in');
  });

  // --- PRELOAD ---

  it('scenes 0, 1, 2, 3, 5 declare preloadImages assets', () => {
    [0, 1, 2, 3, 5].forEach((i) => {
      expect(scenes[i].props.assets?.preloadImages).toBeDefined();
      expect(Array.isArray(scenes[i].props.assets?.preloadImages)).toBe(true);
    });
  });

  it('scenes 4 and 6 do not declare preloadImages', () => {
    [4, 6].forEach((i) => {
      expect(scenes[i].props.assets?.preloadImages).toBeUndefined();
    });
  });

  // --- SCENE IDs ---

  it('each scene has a descriptive sceneId', () => {
    const ids = scenes.map((s) => s.props.sceneId);
    expect(ids).toEqual([
      'panda-cover',
      'panda-profile',
      'panda-feast',
      'panda-habitat',
      'panda-funfacts',
      'panda-conservation',
      'panda-goodbye',
    ]);
  });

  // --- SCENE 0: Cover — waitFor chain ---

  it('Scene 0 uses waitFor dependency chain for title and subtitle', () => {
    const titleAnim = findAnimateById(scenes[0], 's0-title');
    const subAnim = findAnimateById(scenes[0], 's0-sub');

    expect(titleAnim?.props.enterAnimation).toBe('zoom-in');
    expect(titleAnim?.props.timeline?.waitFor).toBe('s0-img');

    expect(subAnim?.props.enterAnimation).toBe('slide-up');
    expect(subAnim?.props.timeline?.waitFor).toBe('s0-title');
  });

  it('Scene 0 has delayed hint animation with pulse', () => {
    const hint = findAnimateById(scenes[0], 's0-hint');

    expect(hint?.props.enterAnimation).toBe('fade-in');
    expect(hint?.props.infiniteAnimation).toBe('pulse');
    expect(hint?.props.timeline?.delay).toBe(1600);
  });

  // --- SCENE 1: Profile — stat blocks + rubber-band ---

  it('Scene 1 has staggered card animations with right-slide and delay', () => {
    const card1 = findAnimateById(scenes[1], 's1-card1');
    const card2 = findAnimateById(scenes[1], 's1-card2');
    const card3 = findAnimateById(scenes[1], 's1-card3');

    expect(card1?.props.enterAnimation).toBe('slide-right');
    expect(card1?.props.timeline?.delay).toBe(200);

    expect(card2?.props.enterAnimation).toBe('slide-right');
    expect(card2?.props.timeline?.delay).toBe(350);

    expect(card3?.props.enterAnimation).toBe('slide-right');
    expect(card3?.props.timeline?.delay).toBe(500);
  });

  it('Scene 1 stats wait for card3 before appearing', () => {
    const stats = findAnimateById(scenes[1], 's1-stats');

    expect(stats?.props.enterAnimation).toBe('fade-in');
    expect(stats?.props.timeline?.waitFor).toBe('s1-card3');
  });

  it('Scene 1 ends with rubber-band fun fact', () => {
    const fact = findAnimateById(scenes[1], 's1-fact');

    expect(fact?.props.enterAnimation).toBe('rubber-band');
    expect(fact?.props.infiniteAnimation).toBe('pulse');
    expect(fact?.props.timeline?.waitFor).toBe('s1-stats');
  });

  // --- SCENE 2: Gallery — varied animations ---

  it('Scene 2 has 6 gallery items with distinct animation types', () => {
    const animations = [0, 1, 2, 3, 4, 5].map((i) => {
      const anim = findAnimateById(scenes[2], `s2-g-${i}`);
      return anim?.props.enterAnimation;
    });

    expect(animations.every(Boolean)).toBe(true);

    expect(animations[0]).toBe('flip');
    expect(animations[1]).toBe('bounce-in');
    expect(animations[2]).toBe('rotate-in');
    // index 3 uses composedPopIn (parallel: scale-up + fade-in)
    expect(animations[4]).toBe('jack-in-the-box');
    expect(animations[5]).toBe('tada');
  });

  it('Scene 2 has jello animation with pulse infinite', () => {
    const panda = findAnimateById(scenes[2], 's2-panda');

    expect(panda?.props.enterAnimation).toBe('jello');
    expect(panda?.props.infiniteAnimation).toBe('pulse');
    expect(panda?.props.timeline?.delay).toBe(1200);
  });

  // --- SCENE 3: Habitat — scene driver + fixed layer ---

  it('Scene 3 uses layout.anchor and stack.cover', () => {
    expect(scenes[3].props.layout).toMatchObject({
      anchor: 'center',
      overflow: 'hidden',
    });
    expect(scenes[3].props.stack).toMatchObject({
      mode: 'cover',
      zIndex: 5,
    });
  });

  it('Scene 3 Animate elements use timeline.driver "scene"', () => {
    const allAnims = findElementsByAnimateId(scenes[3]);

    for (const anim of allAnims) {
      expect(anim.props.timeline?.driver).toBe('scene');
    }
  });

  it('Scene 3 uses heartbeat, wave, wobble animation types', () => {
    const info1 = findAnimateById(scenes[3], 's3-info1');
    const climb = findAnimateById(scenes[3], 's3-climb');
    const info2 = findAnimateById(scenes[3], 's3-info2');

    expect(info1?.props.enterAnimation).toBe('heartbeat');
    expect(climb?.props.enterAnimation).toBe('wave');
    expect(info2?.props.enterAnimation).toBe('wobble');
  });

  // --- SCENE 4: Fun Facts — phase + visibility ---

  it('Scene 4 uses timeline.phase for all fact Animate elements', () => {
    const facts = findElementsByAnimateId(scenes[4]).filter((a) =>
      (a.props.animateId as string).startsWith('s4-f')
    );

    expect(facts.length).toBe(6); // 3 left + 3 right

    for (const fact of facts) {
      expect(fact.props.timeline?.phase).toBeDefined();
      expect(typeof fact.props.timeline?.phase?.start).toBe('number');
      expect(typeof fact.props.timeline?.phase?.end).toBe('number');
      expect(fact.props.visibility?.replayOnReenter).toBe(true);
    }
  });

  it('Scene 4 fact animations include shake, swing, vibrate, roll-in, hinge, flash', () => {
    const animIds = ['s4-fl-0', 's4-fl-1', 's4-fl-2', 's4-fr-0', 's4-fr-1', 's4-fr-2'];
    const animations = animIds.map((id) => findAnimateById(scenes[4], id)?.props.enterAnimation);

    expect(animations).toEqual(['shake', 'swing', 'vibrate', 'roll-in', 'hinge', 'flash']);
  });

  it('Scene 4 has onVisibilityChange callback', () => {
    expect(typeof scenes[4].props.callbacks?.onVisibilityChange).toBe('function');
  });

  // --- SCENE 5: Conservation — custom + composed ---

  it('Scene 5 uses composed sequential animation on card 1', () => {
    const card1 = findAnimateById(scenes[5], 's5-card-1');

    expect(card1?.props.enterAnimation).toMatchObject({
      animations: ['slide-up', 'pulse'],
      mode: 'sequential',
    });
  });

  it('Scene 5 uses custom Framer Motion variant subset animation', () => {
    const custom = findAnimateById(scenes[5], 's5-custom');

    expect(custom?.props.enterAnimation).toMatchObject({
      initial: { opacity: 0, filter: 'blur(8px)', transform: 'scale(0.9)' },
      animate: {
        opacity: 1,
        filter: 'blur(0px)',
        transform: 'scale(1)',
        transition: { duration: 0.8, ease: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' },
      },
    });
  });

  it('Scene 5 CTA button uses bounce-in with pulse infinite', () => {
    const cta = findAnimateById(scenes[5], 's5-cta');

    expect(cta?.props.enterAnimation).toBe('bounce-in');
    expect(cta?.props.infiniteAnimation).toBe('pulse');
    expect(cta?.props.timeline?.delay).toBe(900);
  });

  // --- SCENE 6: Goodbye — exit animations ---

  it('Scene 6 credits block uses blur-in enter and roll-out exit', () => {
    const credits = findAnimateById(scenes[6], 's6-credits');

    expect(credits?.props.enterAnimation).toBe('blur-in');
    expect(credits?.props.exitAnimation).toBe('roll-out');
  });

  it('Scene 6 credit items use distinct exit animations: bounce-out, flip-y, hinge', () => {
    const exits = [0, 1, 2].map((i) => {
      const anim = findAnimateById(scenes[6], `s6-credit-${i}`);
      return anim?.props.exitAnimation;
    });

    expect(exits).toEqual(['bounce-out', 'flip-y', 'hinge']);
  });

  it('Scene 6 has the longest exitDuration (1200ms) and focus-in enter', () => {
    expect(scenes[6].props.transition.exitDuration).toBe(1200);
    expect(scenes[6].props.transition.enterAnimation).toBe('focus-in');
  });

  // --- OVERALL ANIMATION COVERAGE ---

  it('demonstrates 30+ distinct preset animation types across all scenes', () => {
    // Collect from Animate elements
    const allAnims = scenes.flatMap((scene) => findElementsByAnimateId(scene));

    const usedAnimations = new Set<string>();
    for (const anim of allAnims) {
      const enter = anim.props.enterAnimation;
      const exit = anim.props.exitAnimation;
      const infinite = anim.props.infiniteAnimation;

      if (typeof enter === 'string') usedAnimations.add(enter);
      if (typeof exit === 'string') usedAnimations.add(exit);
      if (typeof infinite === 'string') usedAnimations.add(infinite);
    }

    // Also collect from Scene transitions
    for (const scene of scenes) {
      const t = scene.props.transition;
      if (t) {
        if (typeof t.enterAnimation === 'string') usedAnimations.add(t.enterAnimation);
        if (typeof t.exitAnimation === 'string') usedAnimations.add(t.exitAnimation);
      }
    }

    // Basic animations (present in Animate or Scene transitions)
    const expectedBasic = [
      'fade-in',
      'fade-out',
      'slide-up',
      'slide-down',
      'slide-left',
      'slide-right',
      'zoom-in',
      'zoom-out',
      'rotate-in',
      'rotate-out',
      'flip',
      'flip-x',
      'flip-y',
      'bounce-in',
      'bounce-out',
      'blur-in',
      'blur-out',
      'pulse',
      'flash',
      'focus-in',
    ];

    for (const kind of expectedBasic) {
      expect(usedAnimations.has(kind)).toBe(true);
    }

    // Special animations
    const expectedSpecial = [
      'rubber-band',
      'jack-in-the-box',
      'tada',
      'jello',
      'heartbeat',
      'wave',
      'wobble',
      'swing',
      'shake',
      'vibrate',
      'hinge',
      'roll-in',
      'roll-out',
    ];

    for (const kind of expectedSpecial) {
      expect(usedAnimations.has(kind)).toBe(true);
    }
  });
});
