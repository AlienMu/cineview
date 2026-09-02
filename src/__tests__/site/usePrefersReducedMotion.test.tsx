import { act, renderHook } from '@testing-library/react';

jest.doMock(require.resolve('../../../site/node_modules/react'), () => jest.requireActual('react'));

const { usePrefersReducedMotion } =
  require('../../../site/src/hooks/usePrefersReducedMotion') as typeof import('../../../site/src/hooks/usePrefersReducedMotion');

type MediaQueryStub = MediaQueryList & {
  emit(next: boolean): void;
};

function makeMediaQueryList(initial: boolean, legacy = false): MediaQueryStub {
  let matches = initial;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const media = {
    media: '(prefers-reduced-motion: reduce)',
    get matches() {
      return matches;
    },
    onchange: null,
    addEventListener: legacy
      ? undefined
      : (_type: string, listener: EventListenerOrEventListenerObject) => {
          listeners.add(listener as (event: MediaQueryListEvent) => void);
        },
    removeEventListener: legacy
      ? undefined
      : (_type: string, listener: EventListenerOrEventListenerObject) => {
          listeners.delete(listener as (event: MediaQueryListEvent) => void);
        },
    addListener: legacy
      ? (listener: (event: MediaQueryListEvent) => void) => listeners.add(listener)
      : undefined,
    removeListener: legacy
      ? (listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener)
      : undefined,
    dispatchEvent: () => true,
    emit(next: boolean): void {
      matches = next;
      for (const listener of listeners) listener({ matches } as MediaQueryListEvent);
    },
  } as unknown as MediaQueryStub;
  return media;
}

describe('usePrefersReducedMotion', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('tracks modern matchMedia changes while mounted', () => {
    const media = makeMediaQueryList(false);
    window.matchMedia = jest.fn(() => media);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);

    act(() => media.emit(true));
    expect(result.current).toBe(true);

    act(() => media.emit(false));
    expect(result.current).toBe(false);
  });

  it('supports legacy addListener/removeListener media query APIs', () => {
    const media = makeMediaQueryList(false, true);
    window.matchMedia = jest.fn(() => media);
    const { result, unmount } = renderHook(() => usePrefersReducedMotion());

    act(() => media.emit(true));
    expect(result.current).toBe(true);
    unmount();
    act(() => media.emit(false));
    expect(result.current).toBe(true);
  });
});
