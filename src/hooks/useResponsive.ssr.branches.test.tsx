/**
 * @jest-environment node
 *
 * useResponsive SSR 分支补充测试
 * 在 node 环境（window === undefined）下通过 renderToString 触发
 * useState 初始化器的 SSR fallback 分支（lines 34-37 的 `: 750` / `: 1334`）。
 */

import React from 'react';
import { renderToString } from 'react-dom/server';
import { useResponsive } from './useResponsive';

function Probe(): React.ReactElement {
  const { viewportWidth, viewportHeight } = useResponsive();
  return React.createElement('div', null, `${viewportWidth}x${viewportHeight}`);
}

describe('useResponsive SSR fallback (window undefined)', () => {
  it('falls back to design defaults 750x1334 when window is undefined', () => {
    // node environment => `typeof window === 'undefined'` so the useState
    // initializers take the false branch and seed 750 / 1334.
    expect(typeof window).toBe('undefined');
    const html = renderToString(React.createElement(Probe));
    expect(html).toContain('750x1334');
  });
});
