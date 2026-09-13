/**
 * preloadTargets branch coverage tests
 * Covers uncovered branches in resolveScenePreloadTargetImages:
 *  - line 36: addSceneImages receives undefined scene (triggered via numeric target
 *    hitting a sparse array slot; by-id lookups are unaffected)
 *  - line 41: empty string url or duplicate url skipped (deduplication + falsy filter)
 *  - line 58: falsy target (empty string) early-returns
 */

import { resolveScenePreloadTargetImages } from './preloadTargets';

interface SceneLike {
  props: {
    sceneId?: string;
    scroll?: { zoneId?: string };
    assets?: { preloadImages?: string[] };
  };
}

describe('resolveScenePreloadTargetImages branches', () => {
  it('returns [] when targets is undefined or empty', () => {
    const scenes: SceneLike[] = [{ props: { sceneId: 'a', assets: { preloadImages: ['x.jpg'] } } }];
    expect(resolveScenePreloadTargetImages(scenes)).toEqual([]);
    expect(resolveScenePreloadTargetImages(scenes, [])).toEqual([]);
  });

  it('skips an undefined scene slot reached via a numeric target (line 36)', () => {
    // sparse array: index 0 is a hole (undefined). Number target 0 is a valid
    // integer in range, so addSceneImages(scenes[0]) runs with `undefined` and
    // must early-return without throwing.
    const scenes = [
      undefined,
      { props: { sceneId: 'b', assets: { preloadImages: ['b.jpg'] } } },
    ] as unknown as SceneLike[];
    expect(resolveScenePreloadTargetImages(scenes, [0])).toEqual([]);
    // index 1 still resolves normally
    expect(resolveScenePreloadTargetImages(scenes, [1])).toEqual(['b.jpg']);
  });

  it('skips falsy and duplicate urls (line 41)', () => {
    // scene a has an empty-string url (falsy -> skipped) plus a real url.
    // scene b repeats the same real url -> dedup skip on the second pass.
    const scenes: SceneLike[] = [
      { props: { sceneId: 'a', assets: { preloadImages: ['', 'shared.jpg'] } } },
      { props: { sceneId: 'b', assets: { preloadImages: ['shared.jpg'] } } },
    ];
    const result = resolveScenePreloadTargetImages(scenes, ['a', 'b']);
    expect(result).toEqual(['shared.jpg']);
  });

  it('early-returns on a falsy (empty string) non-number target (line 58)', () => {
    const scenes: SceneLike[] = [{ props: { sceneId: 'a', assets: { preloadImages: ['a.jpg'] } } }];
    // '' is not a number, falls to `if (!target) return;` — no scene scan, no images.
    expect(resolveScenePreloadTargetImages(scenes, [''])).toEqual([]);
    // mixed: '' skipped, 'a' resolves
    expect(resolveScenePreloadTargetImages(scenes, ['', 'a'])).toEqual(['a.jpg']);
  });

  it('matches zoneId only when includeZoneIds is enabled', () => {
    const scenes: SceneLike[] = [
      {
        props: { sceneId: 'a', scroll: { zoneId: 'zone-1' }, assets: { preloadImages: ['z.jpg'] } },
      },
    ];
    expect(resolveScenePreloadTargetImages(scenes, ['zone-1'])).toEqual([]);
    expect(resolveScenePreloadTargetImages(scenes, ['zone-1'], { includeZoneIds: true })).toEqual([
      'z.jpg',
    ]);
  });
});
