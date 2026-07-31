import { act } from 'react';
import { render, screen } from '@testing-library/react';
import { createKeyedScrollExternalStore } from '../CineView/scrollExternalStore';
import {
  SceneScrollTimelineContext,
  type SceneScrollTimelineState,
  useSceneScrollZoneTimeline,
} from './sceneScrollRuntime';

function createZoneState(zoneId: string, progressPx: number): SceneScrollTimelineState {
  return {
    zoneId,
    sceneIndex: zoneId === 'zone-a' ? 0 : 1,
    progressPx,
    totalBudgetPx: 100,
    active: progressPx > 0 && progressPx < 100,
    direction: progressPx > 0 ? 'forward' : null,
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
});
