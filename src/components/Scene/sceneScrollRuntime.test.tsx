import { act, useCallback } from 'react';
import { render, screen } from '@testing-library/react';
import { createKeyedScrollExternalStore } from '../CineView/scrollExternalStore';
import {
  SceneScrollTimelineContext,
  type SceneScrollTimelineState,
  useSceneScrollZoneApproach,
  useSceneScrollZoneSelection,
} from './sceneScrollRuntime';

/** Local identity-selection probe over the exported generic (the former
 * production wrapper was removed as production-dead; tests remain its only
 * legitimate consumers and now own it). */
function useSceneScrollZoneTimeline(zoneId: string): SceneScrollTimelineState | null {
  const selectState = useCallback((state: SceneScrollTimelineState | null) => state, []);
  return useSceneScrollZoneSelection(zoneId, true, selectState);
}

function createZoneState(zoneId: string, progressPx: number): SceneScrollTimelineState {
  return {
    zoneId,
    sceneIndex: zoneId === 'zone-a' ? 0 : 1,
    progressPx,
    totalBudgetPx: 100,
    active: progressPx > 0 && progressPx < 100,
    direction: progressPx > 0 ? 'forward' : null,
    approach: 'near',
    sequence: {
      budgets: {},
      totalDurationMs: 100,
      totalBudgetPx: 100,
    },
  };
}

describe('scene scroll zone timeline subscription', () => {
  it('updates the changed zone without rendering subscribers in another zone', () => {
    const zoneA = createZoneState('zone-a', 0);
    const zoneB = createZoneState('zone-b', 0);
    const store = createKeyedScrollExternalStore<
      Record<string, SceneScrollTimelineState>,
      string,
      SceneScrollTimelineState
    >({ 'zone-a': zoneA, 'zone-b': zoneB }, (snapshot, zoneId) => snapshot[zoneId]);
    const renderCounts = { a: 0, b: 0 };

    function ZoneProbe({ zoneId, counter }: { zoneId: string; counter: 'a' | 'b' }): JSX.Element {
      const state = useSceneScrollZoneTimeline(zoneId);
      renderCounts[counter] += 1;
      return <output data-testid={zoneId}>{state?.progressPx ?? -1}</output>;
    }

    render(
      <SceneScrollTimelineContext.Provider value={{ store }}>
        <ZoneProbe zoneId="zone-a" counter="a" />
        <ZoneProbe zoneId="zone-b" counter="b" />
      </SceneScrollTimelineContext.Provider>
    );

    const initialRenders = { ...renderCounts };
    const nextZoneA = createZoneState('zone-a', 25);
    act(() => {
      store.setSnapshot({ 'zone-a': nextZoneA, 'zone-b': zoneB });
    });

    expect(screen.getByTestId('zone-a')).toHaveTextContent('25');
    expect(screen.getByTestId('zone-b')).toHaveTextContent('0');
    expect(renderCounts.a).toBe(initialRenders.a + 1);
    expect(renderCounts.b).toBe(initialRenders.b);
  });

  it('does not rerender an approach-only subscriber for continuous progress frames', () => {
    const store = createKeyedScrollExternalStore<
      Record<string, SceneScrollTimelineState>,
      string,
      SceneScrollTimelineState
    >({ 'zone-a': createZoneState('zone-a', 0) }, (snapshot, zoneId) => snapshot[zoneId]);
    let renders = 0;

    function ApproachProbe(): JSX.Element {
      const approach = useSceneScrollZoneApproach('zone-a');
      renders += 1;
      return <output data-testid="approach">{approach ?? 'none'}</output>;
    }

    render(
      <SceneScrollTimelineContext.Provider value={{ store }}>
        <ApproachProbe />
      </SceneScrollTimelineContext.Provider>
    );

    const initialRenders = renders;
    act(() => {
      store.setSnapshot({ 'zone-a': createZoneState('zone-a', 40) });
    });
    expect(screen.getByTestId('approach')).toHaveTextContent('near');
    expect(renders).toBe(initialRenders);

    act(() => {
      store.setSnapshot({
        'zone-a': { ...createZoneState('zone-a', 80), approach: 'far' },
      });
    });
    expect(screen.getByTestId('approach')).toHaveTextContent('far');
    expect(renders).toBe(initialRenders + 1);
  });
});
