/**
 * useScrollZoneRegistry unit tests (B3 refactor).
 *
 * Duplicate zoneId registration (two Scenes sharing the same sceneId / scroll.zoneId) must follow first-wins semantics.
 * Later registrants and their stale cleanup must not overwrite, modify, or delete the legitimate owner.
 */
import { act, renderHook } from '@testing-library/react';
import type { SceneScrollAnimationRegistration } from '../Scene/sceneScrollBudget';
import { useScrollZoneRegistry } from './useScrollZoneRegistry';

function makeParams(): Parameters<typeof useScrollZoneRegistry>[0] {
  return {
    scrollOffsetRef: { current: 0 },
    measureSceneLayoutsRef: { current: null },
    updateSceneRenderSnapshotsRef: { current: jest.fn() },
  };
}

function makeAnimation(animateId: string, enterDuration: number): SceneScrollAnimationRegistration {
  return {
    animateId,
    delay: 0,
    enterDuration,
    exitDuration: 0,
  };
}

describe('useScrollZoneRegistry — duplicate zone registration diagnostics', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('warns once and rejects a different scene that collides with an existing zone id', () => {
    const { result } = renderHook(() => useScrollZoneRegistry(makeParams()));

    act(() => {
      result.current.zoneRuntimeValue.registerZone('dup', {
        sceneIndex: 0,
        trigger: 'center-lock',
      });
    });
    expect(warnSpy).not.toHaveBeenCalled();

    // A second live registrant (different sceneIndex) collides on the same key.
    act(() => {
      result.current.zoneRuntimeValue.registerZone('dup', {
        sceneIndex: 1,
        trigger: 'center-lock',
      });
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Duplicate scroll zone id "dup"'));
    expect(result.current.zoneRegistryRef.current.get('dup')?.sceneIndex).toBe(0);

    // One-shot: further collisions on the same id stay quiet.
    act(() => {
      result.current.zoneRuntimeValue.registerZone('dup', {
        sceneIndex: 2,
        trigger: 'center-lock',
      });
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('does not warn when the same scene re-registers its own zone id', () => {
    const { result } = renderHook(() => useScrollZoneRegistry(makeParams()));

    act(() => {
      result.current.zoneRuntimeValue.registerZone('solo', {
        sceneIndex: 3,
        trigger: 'center-lock',
      });
    });
    act(() => {
      result.current.zoneRuntimeValue.registerZone('solo', {
        sceneIndex: 3,
        trigger: 'center-lock',
      });
    });

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not warn when a zone id is unregistered before being reused by another scene', () => {
    const { result } = renderHook(() => useScrollZoneRegistry(makeParams()));

    act(() => {
      result.current.zoneRuntimeValue.registerZone('handoff', {
        sceneIndex: 0,
        trigger: 'center-lock',
      });
    });
    act(() => {
      result.current.zoneRuntimeValue.unregisterZone('handoff', 0);
    });
    act(() => {
      result.current.zoneRuntimeValue.registerZone('handoff', {
        sceneIndex: 1,
        trigger: 'center-lock',
      });
    });

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not recreate an unregistered zone when its element cleanup runs later', () => {
    const params = makeParams();
    params.measureSceneLayoutsRef.current = jest.fn();
    const { result } = renderHook(() => useScrollZoneRegistry(params));

    act(() => {
      result.current.zoneRuntimeValue.registerZone('removed', {
        sceneIndex: 4,
        trigger: 'center-lock',
      });
      result.current.zoneRuntimeValue.setZoneElement(
        'removed',
        4,
        document.createElement('section')
      );
      result.current.zoneRuntimeValue.unregisterZone('removed', 4);
      result.current.zoneRuntimeValue.setZoneElement('removed', 4, null);
    });

    expect(result.current.zoneRegistryRef.current.has('removed')).toBe(false);
    expect(params.measureSceneLayoutsRef.current).toHaveBeenCalledTimes(1);
  });

  it('ignores rejected-owner element writes and stale cleanup', () => {
    const params = makeParams();
    params.measureSceneLayoutsRef.current = jest.fn();
    const { result } = renderHook(() => useScrollZoneRegistry(params));
    const winnerElement = document.createElement('section');

    act(() => {
      result.current.zoneRuntimeValue.registerZone('dup', {
        sceneIndex: 0,
        trigger: 'center-lock',
      });
      result.current.zoneRuntimeValue.setZoneElement('dup', 0, winnerElement);
      result.current.zoneRuntimeValue.registerZone('dup', {
        sceneIndex: 1,
        trigger: 'center-lock',
      });
      result.current.zoneRuntimeValue.setZoneElement('dup', 1, document.createElement('aside'));
      result.current.zoneRuntimeValue.unregisterZone('dup', 1);
    });

    expect(result.current.zoneRegistryRef.current.get('dup')).toEqual({
      sceneIndex: 0,
      trigger: 'center-lock',
      element: winnerElement,
    });
    expect(params.measureSceneLayoutsRef.current).toHaveBeenCalledTimes(1);
  });
});

describe('useScrollZoneRegistry — animation registration ownership', () => {
  it('keeps the latest generation when an older owner cleans up', () => {
    const { result } = renderHook(() => useScrollZoneRegistry(makeParams()));
    const runtime = result.current.zoneRuntimeValue;

    act(() => {
      runtime.registerZone('zone', { sceneIndex: 0, trigger: 'center-lock' });
    });

    let ownerA!: SceneScrollAnimationRegistration;
    let ownerB!: SceneScrollAnimationRegistration;
    act(() => {
      ownerA = runtime.registerZoneAnimation('zone', makeAnimation('shared', 100));
      ownerB = runtime.registerZoneAnimation('zone', makeAnimation('shared', 200));
    });
    expect(result.current.zoneAnimationsRef.current.get('zone')?.get('shared')?.enterDuration).toBe(
      200
    );

    act(() => {
      runtime.unregisterZoneAnimation('zone', 'shared', ownerA);
    });
    expect(result.current.zoneAnimationsRef.current.get('zone')?.get('shared')?.enterDuration).toBe(
      200
    );

    act(() => {
      runtime.unregisterZoneAnimation('zone', 'shared', ownerB);
    });
    expect(result.current.zoneAnimationsRef.current.get('zone')?.has('shared')).toBe(false);
  });
});
