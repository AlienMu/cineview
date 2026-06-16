/**
 * Verifies partial-progress commit creates settle snapshot for target scene.
 * Task flow: 2026-06-11-drag-release-progress-settle
 */

import React, { act, createRef } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CineView, Scene, Animate, Position } from '../../index';
import type { CineViewRef } from '../../types';

// ---------------------------------------------------------------------------
// same framer-motion mock as dragModeSettleHandshake.test.tsx
// ---------------------------------------------------------------------------

type PendingAnimation = {
  stop: () => void;
  flush: () => void;
  isStopped: () => boolean;
};

const pendingObjectAnimations: PendingAnimation[] = [];
const pendingNumberAnimations: PendingAnimation[] = [];

async function flushPendingObjectAnimations(): Promise<void> {
  await act(async () => {
    for (const animation of pendingObjectAnimations.splice(0)) {
      if (!animation.isStopped()) animation.flush();
    }
  });
}

async function flushPendingNumberAnimations(): Promise<void> {
  await act(async () => {
    for (const animation of pendingNumberAnimations.splice(0)) {
      if (!animation.isStopped()) animation.flush();
    }
  });
}

jest.mock('framer-motion', () => {
  const React = require('react');
  const createMotionValueStub = (initial: number) => {
    let current = initial;
    const listeners = new Set<(value: number) => void>();
    return {
      get: () => current,
      set: (value: number) => { current = value; listeners.forEach((l) => l(current)); },
      on: (event: string, listener: (value: number) => void) => {
        if (event !== 'change') return () => undefined;
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  };
  const MotionDiv = React.forwardRef(({ children, onPanStart, onPan, onPanEnd, ...props }: any, ref: any) => {
    const startRef = React.useRef(null as { x: number; y: number } | null);
    const lastRef = React.useRef(null as { x: number; y: number } | null);
    const getPoint = (event: React.MouseEvent<HTMLDivElement>) => ({ x: event.clientX, y: event.clientY });
    const buildInfo = (point: { x: number; y: number }) => {
      const start = startRef.current ?? point;
      const last = lastRef.current ?? start;
      return { offset: { x: point.x - start.x, y: point.y - start.y }, velocity: { x: point.x - last.x, y: point.y - last.y } };
    };
    return (
      <div ref={ref} {...props}
        onMouseDown={(event) => { const p = getPoint(event); startRef.current = p; lastRef.current = p; onPanStart?.(); }}
        onMouseMove={(event) => { if (!startRef.current) return; const p = getPoint(event); onPan?.(event.nativeEvent, buildInfo(p)); lastRef.current = p; }}
        onMouseUp={(event) => { if (!startRef.current) return; const p = getPoint(event); onPanEnd?.(event.nativeEvent, buildInfo(p)); startRef.current = null; lastRef.current = null; }}
      >{children}</div>
    );
  });
  MotionDiv.displayName = 'MotionDiv';
  return {
    __esModule: true, motion: { div: MotionDiv },
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useAnimation: () => ({ start: jest.fn().mockResolvedValue(undefined), stop: jest.fn(), set: jest.fn() }),
    useMotionValue: (initial: number) => createMotionValueStub(initial),
    useTransform: (source: any, transform: (value: number) => number) => {
      const motionValue = createMotionValueStub(transform(source.get()));
      source.on?.('change', (value: number) => { motionValue.set(transform(value)); });
      return motionValue;
    },
    animate: (value: any, target: number, options?: any) => {
      const kind = typeof value === 'object' && value?.set ? 'motion-value' : 'number';
      let stopped = false;
      const animation: PendingAnimation = {
        stop: () => { stopped = true; },
        flush: () => {
          if (stopped) return;
          if (typeof value === 'object' && value?.set) value.set?.(target);
          options?.onUpdate?.(target);
          options?.onComplete?.();
          stopped = true;
        },
        isStopped: () => stopped,
      };
      if (kind === 'motion-value') { pendingObjectAnimations.push(animation); options?.onUpdate?.(target * 0.6); if (typeof value === 'object' && value?.set) value.set(target * 0.6); }
      else { pendingNumberAnimations.push(animation); options?.onUpdate?.(target * 0.6); }
      return { stop: animation.stop, flush: animation.flush };
    },
  };
});

(window as any).IntersectionObserver = jest.fn(() => ({ observe: () => null, unobserve: () => null, disconnect: () => null }));

// ---------------------------------------------------------------------------
function renderDragApp(onSceneDidChange: jest.Mock) {
  const cineViewRef = createRef<CineViewRef>();
  render(
    <CineView ref={cineViewRef} mode="drag" modes={{ drag: { direction: 'y', transitionDuration: 800 } }} config={{ width: 750, height: 1334, unit: 'px' }} callbacks={{ common: { onSceneDidChange } }}>
      <Scene transition={{ exitDuration: 800 }}>
        <Position at={{ x: 375, y: 220 }}><Animate animateId="drag-scene-1-title" enterAnimation="fade-in" duration={{ enter: 600 }}><h1>Drag Scene 1</h1></Animate></Position>
      </Scene>
      <Scene transition={{ exitDuration: 800 }}>
        <Position at={{ x: 375, y: 220 }}><Animate animateId="drag-scene-2-title" enterAnimation="fade-in" duration={{ enter: 1400 }}><h1>Drag Scene 2</h1></Animate></Position>
      </Scene>
    </CineView>
  );
  return cineViewRef;
}

function dragUp(surface: HTMLElement, fromY: number, toY: number) {
  fireEvent.mouseDown(surface, { clientX: 375, clientY: fromY });
  fireEvent.mouseMove(surface, { clientX: 375, clientY: toY });
  fireEvent.mouseUp(surface, { clientX: 375, clientY: toY });
}

// ---------------------------------------------------------------------------
describe('partial progress commit', () => {
  beforeEach(() => { jest.clearAllMocks(); pendingObjectAnimations.length = 0; pendingNumberAnimations.length = 0; });

  it('scene changes only after both release lanes complete (dual gate still guards)', async () => {
    const onSceneDidChange = jest.fn();
    const cineViewRef = renderDragApp(onSceneDidChange);
    await waitFor(() => { expect(cineViewRef.current?.getCurrentScene()).toBe(0); });
    const surface = document.querySelector('[data-scene-index="0"] > *') as HTMLElement;
    dragUp(surface, 620, 120);
    // Neither lane complete yet
    expect(cineViewRef.current?.getCurrentScene()).toBe(0);
    // Flush one lane
    await flushPendingNumberAnimations();
    expect(cineViewRef.current?.getCurrentScene()).toBe(0);
    // Flush other lane → commit
    await flushPendingObjectAnimations();
    await waitFor(() => { expect(cineViewRef.current?.getCurrentScene()).toBe(1); });
  });
});
