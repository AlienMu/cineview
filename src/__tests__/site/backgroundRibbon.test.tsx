import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { lutAt } from '../../../site/src/design/lut';

// The site owns react-router-dom in its isolated workspace dependency set. The
// component only needs the pathname today; keep the test focused on real DOM
// mount/replacement mutations without making the framework Jest resolver load
// the site's bundled router package.
jest.doMock(require.resolve('../../../site/node_modules/react'), () => jest.requireActual('react'));
jest.doMock('react-router-dom', () => ({ useLocation: () => ({ pathname: '/demo' }) }), {
  virtual: true,
});

// Load after the site-local React package has been aliased to the renderer's
// singleton; otherwise pnpm's isolated site dependency creates two React
// dispatchers in Jest.

const { BackgroundRibbon } =
  require('../../../site/src/components/BackgroundRibbon') as typeof import('../../../site/src/components/BackgroundRibbon');

const LUT_KEYS = ['--bg-grad-top', '--bg-grad-bot', '--accent', '--accent-ink'] as const;

function setScrollMetrics(element: HTMLElement | null): void {
  if (element === null) return;
  Object.defineProperty(element, 'scrollHeight', {
    configurable: true,
    value: 2_000,
  });
  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    value: 1_000,
  });
}

function rootLut(): Record<(typeof LUT_KEYS)[number], string> {
  const root = document.documentElement.style;
  return Object.fromEntries(LUT_KEYS.map((key) => [key, root.getPropertyValue(key)])) as Record<
    (typeof LUT_KEYS)[number],
    string
  >;
}

function expectRootLut(progress: number): void {
  const expected = lutAt(progress);
  expect(rootLut()).toEqual({
    '--bg-grad-top': expected.top,
    '--bg-grad-bot': expected.bot,
    '--accent': expected.accent,
    '--accent-ink': expected.accentInk,
  });
}

function SiteFixture(): JSX.Element {
  const [generation, setGeneration] = useState(0);
  const [route, setRoute] = useState<'/demo' | '/docs'>('/demo');

  return (
    <div data-testid="site-route" data-route={route}>
      <button
        type="button"
        data-testid="replace-cineview"
        onClick={() => setGeneration((value) => value + 1)}
      >
        replace cineview
      </button>
      <button type="button" onClick={() => setRoute('/docs')}>
        leave cineview
      </button>
      {route === '/demo' ? (
        <div
          key={generation}
          data-testid="cineview-container"
          data-cineview-container="true"
          ref={setScrollMetrics}
        />
      ) : (
        <main data-testid="docs-route">Documentation without CineView</main>
      )}
    </div>
  );
}

function renderSite(): ReturnType<typeof render> {
  return render(
    <>
      <BackgroundRibbon />
      <SiteFixture />
    </>
  );
}

afterEach(() => {
  for (const key of LUT_KEYS) document.documentElement.style.removeProperty(key);
});

describe('BackgroundRibbon container ownership', () => {
  it('reattaches to a same-route CineView replacement and detaches the old listener', async () => {
    renderSite();
    expect(screen.getByTestId('site-route')).toHaveAttribute('data-route', '/demo');
    const oldContainer = screen.getByTestId('cineview-container');

    oldContainer.scrollTop = 500;
    fireEvent.scroll(oldContainer);
    expectRootLut(0.5);

    fireEvent.click(screen.getByRole('button', { name: 'replace cineview' }));
    const newContainer = await waitFor(() => {
      const candidate = screen.getByTestId('cineview-container');
      expect(candidate).not.toBe(oldContainer);
      return candidate;
    });

    newContainer.scrollTop = 750;
    fireEvent.scroll(newContainer);
    await waitFor(() => expectRootLut(0.75));

    oldContainer.scrollTop = 0;
    fireEvent.scroll(oldContainer);
    expectRootLut(0.75);
  });

  it('clears root inline LUT values when leaving to a route without CineView', async () => {
    renderSite();
    const container = screen.getByTestId('cineview-container');
    container.scrollTop = 900;
    fireEvent.scroll(container);
    expectRootLut(0.9);

    fireEvent.click(screen.getByRole('button', { name: 'leave cineview' }));
    await waitFor(() => expect(screen.queryByTestId('cineview-container')).toBeNull());
    expect(screen.getByTestId('site-route')).toHaveAttribute('data-route', '/docs');
    await waitFor(() => {
      expect(rootLut()).toEqual({
        '--bg-grad-top': '',
        '--bg-grad-bot': '',
        '--accent': '',
        '--accent-ink': '',
      });
    });
  });

  it('uses the latest scrollable span when overflow grows without resizing the container box', () => {
    renderSite();
    const container = screen.getByTestId('cineview-container');

    container.scrollTop = 1_000;
    fireEvent.scroll(container);
    expectRootLut(1);

    // Async content can grow scrollHeight while the scroll container keeps the
    // same clientHeight, so ResizeObserver on the container itself does not fire.
    Object.defineProperty(container, 'scrollHeight', {
      configurable: true,
      value: 3_000,
    });
    fireEvent.scroll(container);

    expectRootLut(0.5);
  });

  it('releases browser observers and the active scroll listener on unmount', () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    const resizeDisconnect = jest.fn();
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {
        resizeDisconnect();
      }
    } as unknown as typeof ResizeObserver;
    const mutationDisconnect = jest.spyOn(MutationObserver.prototype, 'disconnect');

    try {
      const { unmount } = renderSite();
      const container = screen.getByTestId('cineview-container');
      const removeListener = jest.spyOn(container, 'removeEventListener');
      container.scrollTop = 500;
      fireEvent.scroll(container);
      expectRootLut(0.5);

      unmount();

      expect(removeListener).toHaveBeenCalledWith('scroll', expect.any(Function));
      expect(resizeDisconnect).toHaveBeenCalledTimes(1);
      expect(mutationDisconnect).toHaveBeenCalledTimes(1);
      expect(rootLut()).toEqual({
        '--bg-grad-top': '',
        '--bg-grad-bot': '',
        '--accent': '',
        '--accent-ink': '',
      });
    } finally {
      mutationDisconnect.mockRestore();
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });
});
