/**
 * @jest-environment node
 *
 * SSR smoke test — locks down "import + first render doesn't crash in a DOM-less environment."
 *
 * Why `@jest-environment node` must be explicit: this repo defaults to `testEnvironment: jsdom`,
 * which provides window/document, so real SSR crashes like "module top-level touches window"
 * **cannot be detected** in the default environment. This test's entire value lies in that missing DOM.
 *
 * Prevents an entire class of regressions: anyone introducing direct access to `window.` / `document.` /
 * `ResizeObserver` in the module initialization path will fail here immediately, rather than waiting
 * for consumers to report errors in Next.js.
 */

import { renderToString } from 'react-dom/server';

import { Animate, CineView, Position, Scene } from '../../index';

describe('SSR smoke (node environment, no DOM)', () => {
  it('confirms current environment truly lacks DOM — otherwise all assertions in this file are false positives', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
  });

  it('scroll mode first render is server-renderable, and child content actually appears in HTML', () => {
    const html = renderToString(
      <CineView mode="scroll" designWidth={750}>
        <Scene sceneId="hero" scroll={{ zoneId: 'z1', trigger: 'center-lock' }}>
          <Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 600 }}>
            <h1>SSR title</h1>
          </Animate>
        </Scene>
      </CineView>
    );

    expect(html).toContain('SSR title');
    expect(html.length).toBeGreaterThan(100);
  });

  it('drag mode first render is server-renderable', () => {
    const html = renderToString(
      <CineView mode="drag" designWidth={750}>
        <Scene sceneId="s1">
          <Animate animateId="a1" enterAnimation="slide-up">
            <p>drag body</p>
          </Animate>
        </Scene>
        <Scene sceneId="s2">
          <p>second</p>
        </Scene>
      </CineView>
    );

    expect(html).toContain('drag body');
  });

  it('minimal zero-props usage is also server-renderable (defaults do not depend on DOM measurements)', () => {
    const html = renderToString(
      <CineView>
        <Scene>
          <div>minimal</div>
        </Scene>
      </CineView>
    );

    expect(html).toContain('minimal');
  });

  it('Position design-pixel conversion does not throw when viewport is absent', () => {
    const html = renderToString(
      <CineView mode="scroll" designWidth={750}>
        <Scene sceneId="s1">
          <Position at={{ x: 0, y: -100, anchor: 'center' }}>
            <span>positioned</span>
          </Position>
        </Scene>
      </CineView>
    );

    expect(html).toContain('positioned');
  });
});
