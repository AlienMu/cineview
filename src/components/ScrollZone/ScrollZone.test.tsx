import { render } from '@testing-library/react';
import { ScrollZone } from './ScrollZone';
import { SceneIdentityContext } from '../Scene/Scene';
import type { ScrollZoneRuntimeContextValue } from './runtime';
import { ScrollZoneRuntimeContext } from './runtime';

describe('ScrollZone', () => {
  function createRuntime(): ScrollZoneRuntimeContextValue {
    return {
      version: 0,
      zoneStates: {},
      registerZone: jest.fn(),
      unregisterZone: jest.fn(),
      setZoneElement: jest.fn(),
      registerZoneAnimation: jest.fn(),
      unregisterZoneAnimation: jest.fn(),
    };
  }

  it('maps public ScrollZone props onto the zone runtime contract', () => {
    const runtime = createRuntime();

    render(
      <SceneIdentityContext.Provider value={2}>
        <ScrollZoneRuntimeContext.Provider value={runtime}>
          <ScrollZone
            zoneId="hero-sequence"
            trigger="center-lock"
            budget={1800}
            replayOnReenter={false}
          >
            <div>Bridge content</div>
          </ScrollZone>
        </ScrollZoneRuntimeContext.Provider>
      </SceneIdentityContext.Provider>
    );

    expect(runtime.registerZone).toHaveBeenCalledWith('hero-sequence', {
      sceneIndex: 2,
      trigger: 'center-lock',
      budget: 1800,
      replayOnReenter: false,
    });
    expect(runtime.setZoneElement).toHaveBeenCalledWith(
      'hero-sequence',
      expect.any(HTMLDivElement)
    );
  });

  it('renders a scroll-zone marker for runtime measurement', () => {
    const runtime = createRuntime();
    const { container } = render(
      <SceneIdentityContext.Provider value={0}>
        <ScrollZoneRuntimeContext.Provider value={runtime}>
          <ScrollZone zoneId="bridge-zone">
            <div>Bridge content</div>
          </ScrollZone>
        </ScrollZoneRuntimeContext.Provider>
      </SceneIdentityContext.Provider>
    );

    const element = container.querySelector('[data-cineview-scroll-zone="bridge-zone"]');

    expect(element).toBeTruthy();
  });

  it('is exported from the package root as the public bridge component', async () => {
    const packageEntry = await import('../../index');

    expect(packageEntry.ScrollZone).toBe(ScrollZone);
  });
});
