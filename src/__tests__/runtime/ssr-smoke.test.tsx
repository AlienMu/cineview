/**
 * @jest-environment node
 *
 * SSR 冒烟 —— 锁住「无 DOM 环境下 import + 首屏渲染不炸」。
 *
 * 为什么必须写死 `@jest-environment node`：本仓库默认 `testEnvironment: jsdom`，
 * 而 jsdom 提供 window/document，于是「模块顶层碰 window」这类真实 SSR 崩溃在
 * 默认环境下**测不出来**。这条测试的全部价值就在于那个缺失的 DOM。
 *
 * 防的是一整类回归：任何人在模块初始化路径上引入 `window.` / `document.` /
 * `ResizeObserver` 的直接访问，这里立刻红，而不是等消费者在 Next.js 里报错。
 */

import { renderToString } from 'react-dom/server';

import { Animate, CineView, Position, Scene } from '../../index';

describe('SSR 冒烟（node 环境，无 DOM）', () => {
  it('确认当前环境真的没有 DOM —— 否则本文件的断言全是假绿', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
  });

  it('scroll 模式首屏可服务端渲染，且子内容真实出现在 HTML 里', () => {
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

  it('drag 模式首屏可服务端渲染', () => {
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

  it('零 props 的最小写法也能服务端渲染（默认值不依赖 DOM 测量）', () => {
    const html = renderToString(
      <CineView>
        <Scene>
          <div>minimal</div>
        </Scene>
      </CineView>
    );

    expect(html).toContain('minimal');
  });

  it('Position 的设计像素换算在无 viewport 时不抛错', () => {
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
