import { act, render } from '@testing-library/react';
import { motionValue } from 'framer-motion';
import { CanvasExtensibilityScene } from '../../../site/src/components/CanvasExtensibilityScene';
import { drawCanvasTargets } from '../../../site/src/components/canvasExtensibility';
import type { AnimateProps } from '../../types';

const mockProgress = motionValue(0);

jest.mock('../../../site/node_modules/react', () => jest.requireActual('react'));
jest.mock(
  'cineview',
  () => ({
    Animate: (props: AnimateProps) => props.children,
    useAnimateTimeline: () => ({ progress: mockProgress }),
  }),
  { virtual: true }
);
jest.mock('../../../site/src/i18n', () => ({ useI18n: () => ({ lang: 'en' }) }));
jest.mock('../../../site/src/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => false,
}));
jest.mock('../../../site/src/components/canvasExtensibility', () => ({
  ...jest.requireActual('../../../site/src/components/canvasExtensibility'),
  buildCanvasTargets: jest.fn(() => ({ particleCount: 20 })),
  drawCanvasTargets: jest.fn(),
}));

it('draws at viewport edge contact and pauses only after leaving the viewport', () => {
  const previousObserver = window.IntersectionObserver;
  let notify: IntersectionObserverCallback;
  const disconnect = jest.fn();
  window.IntersectionObserver = jest.fn((callback: IntersectionObserverCallback) => {
    notify = callback;
    return { observe: jest.fn(), disconnect };
  }) as unknown as typeof IntersectionObserver;
  jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue({} as CanvasRenderingContext2D);
  jest.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 1440,
    height: 900,
  } as DOMRect);
  const root = document.createElement('div');
  root.dataset.cineviewContainer = 'true';
  document.body.append(root);
  const view = render(<CanvasExtensibilityScene />, { container: root });
  const canvas = root.querySelector('canvas')!;
  const intersect = (isIntersecting: boolean): void => {
    act(() =>
      notify(
        [
          {
            target: canvas,
            isIntersecting,
            intersectionRatio: 0,
            boundingClientRect: canvas.getBoundingClientRect(),
            intersectionRect: new DOMRect(),
            rootBounds: null,
            time: 0,
          },
        ],
        {} as IntersectionObserver
      )
    );
  };
  try {
    expect(window.IntersectionObserver).toHaveBeenCalledWith(expect.any(Function), { root });
    expect(drawCanvasTargets).not.toHaveBeenCalled();
    // At threshold 0, edge contact is an intersection even with no visible area.
    // Increasing its area need not deliver a second observer callback.
    intersect(true);
    expect(canvas).toHaveAttribute('data-canvas-ready', 'true');
    act(() => mockProgress.set(0.4));
    expect(canvas).toHaveAttribute('data-progress', '0.4');
    intersect(false);
    jest.mocked(drawCanvasTargets).mockClear();
    act(() => mockProgress.set(0.6));
    expect(drawCanvasTargets).not.toHaveBeenCalled();
    intersect(true);
    expect(canvas).toHaveAttribute('data-progress', '0.6');
    view.unmount();
    expect(disconnect).toHaveBeenCalled();
    jest.mocked(drawCanvasTargets).mockClear();
    act(() => mockProgress.set(0.8));
    expect(drawCanvasTargets).not.toHaveBeenCalled();
  } finally {
    view.unmount();
    root.remove();
    window.IntersectionObserver = previousObserver;
    jest.restoreAllMocks();
  }
});
