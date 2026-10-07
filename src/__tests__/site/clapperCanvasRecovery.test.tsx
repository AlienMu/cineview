import { act, render } from '@testing-library/react';
import { motionValue } from 'framer-motion';
import { ClapperboardCanvas } from '../../../site/src/components/temporal-drag/clapperboard/ClapperboardCanvas';
import type { AnimatePhase } from '../../types';

jest.mock('../../../site/node_modules/react', () => jest.requireActual('react'));

it('reestablishes the pixel scale before clearing and drawing after a canvas state reset', () => {
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  let scale = 1;
  const clearedScales: number[] = [];
  const paintedScales: number[] = [];
  const ctx = {
    setTransform: jest.fn((a: number) => {
      scale = a;
    }),
    clearRect: jest.fn(() => {
      clearedScales.push(scale);
    }),
    fillRect: jest.fn(() => {
      paintedScales.push(scale);
    }),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
  } as unknown as CanvasRenderingContext2D;
  const dpr = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
  const resizeObserver = window.ResizeObserver;
  window.ResizeObserver = jest.fn(() => ({
    observe: jest.fn(),
    disconnect: jest.fn(),
  })) as unknown as typeof ResizeObserver;
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 3 });
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
  jest
    .spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect')
    .mockReturnValue({ width: 344, height: 595 } as DOMRect);
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
  const progress = motionValue(0.3);
  const phase = motionValue<AnimatePhase>('entering');
  const view = render(<ClapperboardCanvas progress={progress} phase={phase} />);
  try {
    // A restored 2D context starts with identity, even though the element retains its
    // high-resolution backing dimensions. The next frame must clear and paint at 2x.
    scale = 1;
    clearedScales.length = 0;
    paintedScales.length = 0;
    act(() => {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(16));
    });
    expect(clearedScales).toEqual([2]);
    expect(paintedScales.length).toBeGreaterThan(0);
    expect(paintedScales.every((value) => value === 2)).toBe(true);
  } finally {
    view.unmount();
    if (dpr) Object.defineProperty(window, 'devicePixelRatio', dpr);
    window.ResizeObserver = resizeObserver;
    jest.restoreAllMocks();
  }
});
