import { render } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import { useSceneScrollTakeover } from './useSceneScrollTakeover';
import { SceneScrollRuntimeContext, SceneScrollTakeoverContext } from './sceneScrollRuntime';

function Probe({
  mode = 'scroll',
  sceneId,
  sceneIndex = 1,
  scroll = { zoneId: 'demo-zone', trigger: 'center-lock' as const },
}: {
  mode?: 'drag' | 'scroll';
  sceneId?: string;
  sceneIndex?: number;
  scroll?: {
    zoneId?: string;
    trigger?: 'center-lock';
  };
}): JSX.Element {
  const ref = React.useRef<HTMLDivElement>(null);
  const zoneId = useSceneScrollTakeover({
    sceneId,
    sceneIndex,
    mode,
    scroll,
    elementRef: ref,
  });

  return (
    <SceneScrollTakeoverContext.Provider value={zoneId}>
      <div ref={ref} data-zone-id={zoneId ?? ''}>
        takeover
      </div>
    </SceneScrollTakeoverContext.Provider>
  );
}

describe('useSceneScrollTakeover', () => {
  it('registers scene takeover config with the scroll runtime', () => {
    const runtime = {
      version: 0,
      zoneStates: {},
      registerZone: jest.fn(),
      unregisterZone: jest.fn(),
      setZoneElement: jest.fn(),
      registerZoneAnimation: jest.fn(),
      unregisterZoneAnimation: jest.fn(),
    };

    render(
      <SceneScrollRuntimeContext.Provider value={runtime}>
        <Probe />
      </SceneScrollRuntimeContext.Provider>
    );

    expect(runtime.registerZone).toHaveBeenCalledWith('demo-zone', {
      sceneIndex: 1,
      trigger: 'center-lock',
    });
    expect(runtime.setZoneElement).toHaveBeenCalledWith('demo-zone', expect.any(HTMLDivElement));
  });

  it('does nothing outside scroll mode', () => {
    const runtime = {
      version: 0,
      zoneStates: {},
      registerZone: jest.fn(),
      unregisterZone: jest.fn(),
      setZoneElement: jest.fn(),
      registerZoneAnimation: jest.fn(),
      unregisterZoneAnimation: jest.fn(),
    };

    render(
      <SceneScrollRuntimeContext.Provider value={runtime}>
        <Probe mode="drag" />
      </SceneScrollRuntimeContext.Provider>
    );

    expect(runtime.registerZone).not.toHaveBeenCalled();
    expect(runtime.setZoneElement).not.toHaveBeenCalled();
  });

  it('does not re-register when runtime state changes but handler refs stay stable', () => {
    const registerZone = jest.fn();
    const unregisterZone = jest.fn();
    const setZoneElement = jest.fn();
    const registerZoneAnimation = jest.fn();
    const unregisterZoneAnimation = jest.fn();

    const { rerender } = render(
      <SceneScrollRuntimeContext.Provider
        value={{
          version: 0,
          zoneStates: {},
          registerZone,
          unregisterZone,
          setZoneElement,
          registerZoneAnimation,
          unregisterZoneAnimation,
        }}
      >
        <Probe />
      </SceneScrollRuntimeContext.Provider>
    );

    expect(registerZone).toHaveBeenCalledTimes(1);
    expect(setZoneElement).toHaveBeenCalledTimes(1);

    rerender(
      <SceneScrollRuntimeContext.Provider
        value={{
          version: 1,
          zoneStates: {
            'demo-zone': {
              zoneId: 'demo-zone',
              sceneIndex: 1,
              progressPx: 120,
              totalBudgetPx: 600,
              active: true,
              direction: 'forward',
              sequence: {
                totalBudgetPx: 600,
                totalDurationMs: 1000,
                budgets: {},
              },
            },
          },
          registerZone,
          unregisterZone,
          setZoneElement,
          registerZoneAnimation,
          unregisterZoneAnimation,
        }}
      >
        <Probe />
      </SceneScrollRuntimeContext.Provider>
    );

    expect(registerZone).toHaveBeenCalledTimes(1);
    expect(setZoneElement).toHaveBeenCalledTimes(1);
  });
});
