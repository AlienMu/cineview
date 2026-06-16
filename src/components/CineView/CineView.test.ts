import { resolveActiveViewportId } from './CineView';

function createRect(top: number, height: number): DOMRect {
  return {
    x: 0,
    y: top,
    width: 800,
    height,
    top,
    right: 800,
    bottom: top + height,
    left: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

function createViewportElement(top: number, height: number): HTMLElement {
  return {
    getBoundingClientRect: () => createRect(top, height),
  } as HTMLElement;
}

describe('resolveActiveViewportId', () => {
  it('selects the nearest visible viewport in the active scene without a center threshold', () => {
    const registry = new Map([
      [
        'scene-0-far',
        {
          sceneIndex: 0,
          trigger: 'center-lock' as const,
          element: createViewportElement(120, 120),
        },
      ],
      [
        'scene-0-near',
        {
          sceneIndex: 0,
          trigger: 'center-lock' as const,
          element: createViewportElement(390, 180),
        },
      ],
      [
        'scene-1-near',
        {
          sceneIndex: 1,
          trigger: 'center-lock' as const,
          element: createViewportElement(420, 120),
        },
      ],
    ]);

    const activeViewportId = resolveActiveViewportId(registry, 0, createRect(0, 900), 900);

    expect(activeViewportId).toBe('scene-0-near');
  });

  it('keeps the current viewport active while its timeline is mid-progress', () => {
    const registry = new Map([
      [
        'scene-0-sticky',
        {
          sceneIndex: 0,
          trigger: 'center-lock' as const,
          element: createViewportElement(120, 120),
        },
      ],
    ]);

    const activeViewportId = resolveActiveViewportId(
      registry,
      0,
      createRect(0, 900),
      900,
      {
        'scene-0-sticky': {
          zoneId: 'scene-0-sticky',
          sceneIndex: 0,
          progressPx: 180,
          totalBudgetPx: 400,
          active: true,
          direction: 'backward',
          sequence: {
            budgets: {},
            totalDurationMs: 2000,
            totalBudgetPx: 400,
          },
        },
      },
      'scene-0-sticky'
    );

    expect(activeViewportId).toBe('scene-0-sticky');
  });

  it('returns null when the active scene has no visible viewport candidates', () => {
    const registry = new Map([
      [
        'scene-0-hidden',
        {
          sceneIndex: 0,
          trigger: 'center-lock' as const,
          element: createViewportElement(-300, 120),
        },
      ],
    ]);

    const activeViewportId = resolveActiveViewportId(registry, 0, createRect(0, 900), 900);

    expect(activeViewportId).toBeNull();
  });
});
