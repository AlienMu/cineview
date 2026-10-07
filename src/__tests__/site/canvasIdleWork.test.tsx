import { act, render } from '@testing-library/react';
import { motionValue } from 'framer-motion';
import type { AnimatePhase } from '../../types';
import { ApertureCanvas } from '../../../site/src/components/temporal-drag/aperture/ApertureCanvas';
import { WaveformCanvas } from '../../../site/src/components/temporal-drag/waveform/WaveformCanvas';

jest.mock('../../../site/node_modules/react', () => jest.requireActual('react'));

it.each([
  ['aperture', ApertureCanvas],
  ['waveform', WaveformCanvas],
] as const)('%s stops empty frames and resumes on progress or restored dimensions', (_, Canvas) => {
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  let resize = (): void => {};
  let width = 330;
  const context = {
    setTransform: jest.fn(),
    clearRect: jest.fn(),
    fillRect: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
    beginPath: jest.fn(),
    closePath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    arc: jest.fn(),
    quadraticCurveTo: jest.fn(),
    createRadialGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
  };
  const originalObserver = window.ResizeObserver;
  window.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) {
      resize = () => callback([], this);
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
  jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(context as unknown as CanvasRenderingContext2D);
  jest
    .spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect')
    .mockImplementation(() => ({ width, height: 330 }) as DOMRect);
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => frames.delete(id));
  const step = (): void => {
    act(() => {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((callback) => callback(16));
    });
  };
  const progress = motionValue(0);
  const phase = motionValue<AnimatePhase>('entering');
  const view = render(<Canvas progress={progress} phase={phase} />);
  try {
    expect(frames.size).toBe(0);
    context.clearRect.mockClear();
    for (let index = 0; index < 60; index += 1) step();
    expect(context.clearRect).not.toHaveBeenCalled();

    act(() => progress.set(0.5));
    expect(frames.size).toBe(1);
    step();
    expect(context.fillRect).toHaveBeenCalled();
    expect(frames.size).toBe(1);

    act(() => {
      phase.set('exiting');
      progress.set(1);
    });
    step();
    expect(frames.size).toBe(0);
    context.fillRect.mockClear();
    context.clearRect.mockClear();
    for (let index = 0; index < 60; index += 1) step();
    expect(context.fillRect).not.toHaveBeenCalled();
    expect(context.clearRect).not.toHaveBeenCalled();

    // The phase stays exiting when the same gesture reverses.
    act(() => progress.set(0.5));
    expect(frames.size).toBe(1);
    step();
    expect(context.fillRect).toHaveBeenCalled();
    expect(frames.size).toBe(1);

    width = 0;
    act(resize);
    step();
    expect(frames.size).toBe(0);
    width = 330;
    act(resize);
    expect(frames.size).toBe(1);
    const canvas = view.container.querySelector('canvas')!;
    act(() => canvas.dispatchEvent(new Event('contextrestored')));
    expect(frames.size).toBe(1);

    act(() => phase.set('idle'));
    expect(frames.size).toBe(0);
    act(() => progress.set(0.6));
    expect(frames.size).toBe(0);
    act(() => phase.set('entering'));
    expect(frames.size).toBe(1);
    view.unmount();
    expect(frames.size).toBe(0);
    act(() => {
      progress.set(0.7);
      phase.set('entered');
    });
    expect(frames.size).toBe(0);
  } finally {
    view.unmount();
    progress.destroy();
    phase.destroy();
    window.ResizeObserver = originalObserver;
    jest.restoreAllMocks();
  }
});
