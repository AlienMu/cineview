/**
 * Position 组件单元测试
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Position } from './Position';
import { CineViewProvider } from '../../context/CineViewContext';
import { CineViewRuntimeContext } from '../CineView/runtimeContext';
import { SceneFixedLayerContext } from './Position';

// 测试辅助函数：创建带 Context 的包装器
const renderWithContext = (
  ui: React.ReactElement,
  options: {
    designSize?: number;
    designWidth?: number;
    designHeight?: number;
  } = {}
): ReturnType<typeof render> => {
  const { designSize = 750, designWidth = designSize, designHeight = designSize } = options;
  return render(
    <CineViewProvider designWidth={designWidth} designHeight={designHeight}>
      {ui}
    </CineViewProvider>
  );
};

describe('Position Component', () => {
  // 在每个测试前设置 window.innerWidth 为 750，使 scale = 1
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 750,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 750,
    });
  });

  describe('绝对定位计算', () => {
    it('应该正确计算绝对 X 坐标', () => {
      renderWithContext(
        <Position x={100}>
          <div data-testid="child">Content</div>
        </Position>,
        { designWidth: 750, designHeight: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      expect(parent).toHaveStyle({
        position: 'absolute',
        left: '100px',
        top: '0px',
      });
    });

    it('应该正确计算绝对 Y 坐标', () => {
      renderWithContext(
        <Position y={200}>
          <div data-testid="child">Content</div>
        </Position>,
        { designWidth: 750, designHeight: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      expect(parent).toHaveStyle({
        position: 'absolute',
        left: '0px',
        top: '200px',
      });
    });

    it('应该正确计算绝对 X 和 Y 坐标', () => {
      renderWithContext(
        <Position x={100} y={200}>
          <div data-testid="child">Content</div>
        </Position>,
        { designWidth: 750, designHeight: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      expect(parent).toHaveStyle({
        position: 'absolute',
        left: '100px',
        top: '200px',
      });
    });

    it('应该用宽度尺(px2vw 单尺子)换算 Y 坐标，与 designHeight/viewportHeight 无关', () => {
      // px2vw 单尺子：x 和 y 都乘同一个 scale = viewportWidth / designWidth。
      // 这里 viewportWidth=375、designWidth=750 → scale=0.5。designHeight 与
      // viewportHeight 取任意值都不影响 y 的换算（不再按纵轴独立拉伸）。
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 500,
      });

      renderWithContext(
        <Position x={100} y={200}>
          <div data-testid="child">Content</div>
        </Position>,
        { designWidth: 750, designHeight: 1000 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      // 两轴共用 scale=0.5：100→50px、200→100px（top 不再是旧双轴的 200*500/1000=100 巧合值，
      // 而是 200*0.5=100 由宽度尺得出；下方 designHeight 变体证明其与高度无关）。
      expect(parent).toHaveStyle({
        left: '50px',
        top: '100px',
      });
    });

    it('Y 坐标换算对 designHeight 不敏感（单尺子证明）', () => {
      // 同样 viewportWidth=375、designWidth=750 → scale=0.5。把 designHeight 从 1000
      // 改成 2000，若仍是旧双轴模型 top 会随之减半；单尺子下 top 恒为 200*0.5=100px。
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 500,
      });

      renderWithContext(
        <Position y={200}>
          <div data-testid="child">Content</div>
        </Position>,
        { designWidth: 750, designHeight: 2000 }
      );

      const parent = screen.getByTestId('child').parentElement;
      expect(parent).toHaveStyle({ top: '100px' });
    });

    it('应该在没有任何坐标时使用默认值 (0, 0)', () => {
      renderWithContext(
        <Position>
          <div data-testid="child">Content</div>
        </Position>
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      expect(parent).toHaveStyle({
        position: 'absolute',
        left: '0px',
        top: '0px',
      });
    });
  });

  describe('相对定位累加', () => {
    it('应该正确计算相对 X 偏移', () => {
      renderWithContext(
        <Position offsetX={50}>
          <div data-testid="child">Content</div>
        </Position>,
        { designWidth: 750, designHeight: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      expect(parent).toHaveStyle({
        position: 'absolute',
        left: '50px',
        top: '0px',
      });
    });

    it('应该正确计算相对 Y 偏移', () => {
      renderWithContext(
        <Position offsetY={100}>
          <div data-testid="child">Content</div>
        </Position>,
        { designWidth: 750, designHeight: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      expect(parent).toHaveStyle({
        position: 'absolute',
        left: '0px',
        top: '100px',
      });
    });

    it('应该正确累加嵌套的相对定位', () => {
      renderWithContext(
        <Position offsetX={50} offsetY={100}>
          <Position offsetX={30} offsetY={40}>
            <div data-testid="child">Content</div>
          </Position>
        </Position>,
        { designWidth: 750, designHeight: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      // 第二层应该累加第一层的偏移：(50 + 30, 100 + 40)
      expect(parent).toHaveStyle({
        position: 'absolute',
        left: '80px',
        top: '140px',
      });
    });

    it('应该正确累加多层嵌套的相对定位', () => {
      renderWithContext(
        <Position offsetX={10} offsetY={20}>
          <Position offsetX={30} offsetY={40}>
            <Position offsetX={50} offsetY={60}>
              <div data-testid="child">Content</div>
            </Position>
          </Position>
        </Position>,
        { designWidth: 750, designHeight: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      // 累加所有层级：(10 + 30 + 50, 20 + 40 + 60)
      expect(parent).toHaveStyle({
        position: 'absolute',
        left: '90px',
        top: '120px',
      });
    });
  });

  describe('优先级处理', () => {
    it('绝对定位应该优先于相对定位（同时存在 x 和 offsetX）', () => {
      renderWithContext(
        <Position x={100} offsetX={50}>
          <div data-testid="child">Content</div>
        </Position>,
        { designWidth: 750, designHeight: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      // 应该使用绝对定位 x=100，忽略 offsetX=50
      expect(parent).toHaveStyle({
        position: 'absolute',
        left: '100px',
      });
    });

    it('绝对定位应该优先于相对定位（同时存在 y 和 offsetY）', () => {
      renderWithContext(
        <Position y={200} offsetY={100}>
          <div data-testid="child">Content</div>
        </Position>,
        { designWidth: 750, designHeight: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      // 应该使用绝对定位 y=200，忽略 offsetY=100
      expect(parent).toHaveStyle({
        position: 'absolute',
        top: '200px',
      });
    });

    it('绝对定位应该优先于相对定位（所有参数都存在）', () => {
      renderWithContext(
        <Position x={100} y={200} offsetX={50} offsetY={100}>
          <div data-testid="child">Content</div>
        </Position>,
        { designWidth: 750, designHeight: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      // 应该使用绝对定位，忽略相对定位
      expect(parent).toHaveStyle({
        position: 'absolute',
        left: '100px',
        top: '200px',
      });
    });

    it('嵌套时，子组件的绝对定位应该忽略父组件的位置', () => {
      renderWithContext(
        <Position offsetX={50} offsetY={100}>
          <Position x={200} y={300}>
            <div data-testid="child">Content</div>
          </Position>
        </Position>,
        { designWidth: 750, designHeight: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      // 子组件使用绝对定位，不受父组件影响
      expect(parent).toHaveStyle({
        position: 'absolute',
        left: '200px',
        top: '300px',
      });
    });
  });

  describe('响应式换算', () => {
    it('应该根据设计稿尺寸正确换算（px 单位）', () => {
      // 设计稿 750px，视口 750px，比例 1:1
      renderWithContext(
        <Position x={100} y={200}>
          <div data-testid="child">Content</div>
        </Position>,
        { designWidth: 750, designHeight: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      expect(parent).toHaveStyle({
        left: '100px',
        top: '200px',
      });
    });

    it('应该根据设计稿尺寸正确换算（不同设计稿尺寸）', () => {
      // 设计稿 375px，视口 750px，scale = 750/375 = 2
      renderWithContext(
        <Position x={100} y={200}>
          <div data-testid="child">Content</div>
        </Position>,
        { designWidth: 375, designHeight: 375 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      // 100 * 2 = 200, 200 * 2 = 400
      expect(parent).toHaveStyle({
        left: '200px',
        top: '400px',
      });
    });

    it('应该正确处理小数值', () => {
      renderWithContext(
        <Position x={100.5} y={200.75}>
          <div data-testid="child">Content</div>
        </Position>,
        { designWidth: 750, designHeight: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      expect(parent).toHaveStyle({
        left: '100.5px',
        top: '200.75px',
      });
    });
  });

  describe('边界值处理', () => {
    it('应该正确处理零值', () => {
      renderWithContext(
        <Position x={0} y={0}>
          <div data-testid="child">Content</div>
        </Position>,
        { designWidth: 750, designHeight: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      expect(parent).toHaveStyle({
        left: '0px',
        top: '0px',
      });
    });

    it('应该正确处理负值', () => {
      renderWithContext(
        <Position x={-50} y={-100}>
          <div data-testid="child">Content</div>
        </Position>,
        { designWidth: 750, designHeight: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      expect(parent).toHaveStyle({
        left: '-50px',
        top: '-100px',
      });
    });

    it('应该正确处理大数值', () => {
      renderWithContext(
        <Position x={10000} y={20000}>
          <div data-testid="child">Content</div>
        </Position>,
        { designWidth: 750, designHeight: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      expect(parent).toHaveStyle({
        left: '10000px',
        top: '20000px',
      });
    });

    it('应该正确处理相对定位的负值累加', () => {
      renderWithContext(
        <Position offsetX={100} offsetY={200}>
          <Position offsetX={-50} offsetY={-100}>
            <div data-testid="child">Content</div>
          </Position>
        </Position>,
        { designWidth: 750, designHeight: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      // 累加：(100 - 50, 200 - 100)
      expect(parent).toHaveStyle({
        left: '50px',
        top: '100px',
      });
    });
  });

  describe('窗口 resize 响应', () => {
    it('应该在窗口 resize 后重新计算位置', async () => {
      // 注意：由于 resize 事件使用了 debounce，实际测试中需要等待
      // 这里我们主要测试组件是否正确使用了 Context 中的 convertSize
      const { rerender } = renderWithContext(
        <Position x={100} y={200}>
          <div data-testid="child">Content</div>
        </Position>,
        { designWidth: 750, designHeight: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      expect(parent).toHaveStyle({
        left: '100px',
        top: '200px',
      });

      // 重新渲染以模拟 Context 更新
      rerender(
        <CineViewProvider designWidth={750} designHeight={750}>
          <Position x={100} y={200}>
            <div data-testid="child">Content</div>
          </Position>
        </CineViewProvider>
      );

      // 位置应该保持一致（因为设计稿尺寸没变）
      expect(parent).toHaveStyle({
        left: '100px',
        top: '200px',
      });
    });
  });

  describe('居中定位 (anchor)', () => {
    it('anchor=center 时水平垂直都居中（left/top=50% + translate(-50%)）', () => {
      renderWithContext(
        <Position at={{ anchor: 'center' }}>
          <div data-testid="child">Content</div>
        </Position>,
        { designWidth: 750, designHeight: 750 }
      );

      const parent = screen.getByTestId('child').parentElement;
      expect(parent).toHaveStyle({
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translateX(-50%) translateY(-50%)',
      });
    });

    it('anchor=center-x 只水平居中，y 仍为绝对坐标', () => {
      renderWithContext(
        <Position at={{ anchor: 'center-x', y: 200 }}>
          <div data-testid="child">Content</div>
        </Position>,
        { designWidth: 750, designHeight: 750 }
      );

      const parent = screen.getByTestId('child').parentElement;
      expect(parent).toHaveStyle({
        left: '50%',
        top: '200px',
        transform: 'translateX(-50%)',
      });
    });

    it('anchor=center-y 只垂直居中，x 仍为绝对坐标', () => {
      renderWithContext(
        <Position at={{ anchor: 'center-y', x: 100 }}>
          <div data-testid="child">Content</div>
        </Position>,
        { designWidth: 750, designHeight: 750 }
      );

      const parent = screen.getByTestId('child').parentElement;
      expect(parent).toHaveStyle({
        left: '100px',
        top: '50%',
        transform: 'translateY(-50%)',
      });
    });

    it('居中后仍可用 x/y 设置相对中心的偏移（calc(50% + offset)）', () => {
      renderWithContext(
        <Position at={{ anchor: 'center', x: 40, y: -30 }}>
          <div data-testid="child">Content</div>
        </Position>,
        { designWidth: 750, designHeight: 750 }
      );

      const parent = screen.getByTestId('child').parentElement;
      expect(parent).toHaveStyle({
        left: 'calc(50% + 40px)',
        top: 'calc(50% + -30px)',
        transform: 'translateX(-50%) translateY(-50%)',
      });
    });

    it('居中 transform 与用户自定义 transform 叠加（居中在前）', () => {
      renderWithContext(
        <Position at={{ anchor: 'center' }} style={{ transform: 'rotate(10deg)' }}>
          <div data-testid="child">Content</div>
        </Position>,
        { designWidth: 750, designHeight: 750 }
      );

      const parent = screen.getByTestId('child').parentElement;
      expect(parent).toHaveStyle({
        transform: 'translateX(-50%) translateY(-50%) rotate(10deg)',
      });
    });
  });

  describe('子元素渲染', () => {
    it('应该正确渲染子元素', () => {
      renderWithContext(
        <Position x={100} y={200}>
          <div data-testid="child">Test Content</div>
        </Position>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('应该正确渲染多个子元素', () => {
      renderWithContext(
        <Position x={100} y={200}>
          <div data-testid="child1">Content 1</div>
          <div data-testid="child2">Content 2</div>
        </Position>
      );

      expect(screen.getByTestId('child1')).toBeInTheDocument();
      expect(screen.getByTestId('child2')).toBeInTheDocument();
    });

    it('应该正确渲染嵌套的 Position 组件', () => {
      renderWithContext(
        <Position x={100} y={200}>
          <Position offsetX={50} offsetY={100}>
            <div data-testid="nested-child">Nested Content</div>
          </Position>
        </Position>
      );

      expect(screen.getByTestId('nested-child')).toBeInTheDocument();
    });
  });

  describe('Context 传递', () => {
    it('应该正确传递位置上下文给子 Position 组件', () => {
      renderWithContext(
        <Position x={100} y={200}>
          <div data-testid="parent-child">Parent</div>
          <Position offsetX={50} offsetY={100}>
            <div data-testid="child">Child</div>
          </Position>
        </Position>
      );

      const parentChild = screen.getByTestId('parent-child');
      const parentContainer = parentChild.parentElement;

      const child = screen.getByTestId('child');
      const childContainer = child.parentElement;

      // 父组件使用绝对定位
      expect(parentContainer).toHaveStyle({
        left: '100px',
        top: '200px',
      });

      // 子组件应该基于父组件的绝对位置进行相对定位
      // 但由于父组件使用了绝对定位，子组件的相对定位会从 (100, 200) 开始
      expect(childContainer).toHaveStyle({
        left: '150px', // 100 + 50
        top: '300px', // 200 + 100
      });
    });
  });

  describe('错误处理', () => {
    it('应该在 scroll 模式下优先把 scene 内 fixed 图层 portal 到 scene host', () => {
      const fixedHost = document.createElement('div');
      document.body.appendChild(fixedHost);
      const { container } = renderWithContext(
        <CineViewRuntimeContext.Provider value={{ mode: 'scroll' }}>
          <SceneFixedLayerContext.Provider value={fixedHost}>
            <Position x={100} y={200} layer={{ fixed: true }}>
              <div data-testid="sticky-child">Content</div>
            </Position>
          </SceneFixedLayerContext.Provider>
        </CineViewRuntimeContext.Provider>
      );

      const child = screen.getByTestId('sticky-child');
      const parent = child.parentElement;

      expect(parent).toHaveStyle({
        position: 'absolute',
        left: '100px',
        top: '200px',
      });
      expect(fixedHost).toContainElement(child);
      expect(container).not.toContainElement(child);

      fixedHost.remove();
    });

    it('应该在 scroll 模式下把没有 scene host 的 fixed 图层保留为 sticky', () => {
      renderWithContext(
        <CineViewRuntimeContext.Provider value={{ mode: 'scroll' }}>
          <section data-testid="ordinary-region">
            <Position x={64} y={128} layer={{ fixed: true }}>
              <div data-testid="ordinary-sticky-child">Content</div>
            </Position>
          </section>
        </CineViewRuntimeContext.Provider>
      );

      const region = screen.getByTestId('ordinary-region');
      const child = screen.getByTestId('ordinary-sticky-child');
      const parent = child.parentElement;

      expect(parent).toHaveStyle({
        position: 'sticky',
        left: '64px',
        top: '128px',
      });
      expect(region).toContainElement(child);
    });

    it('应该在没有 scene host 时保留 fixed 内容，而不是直接消失', () => {
      renderWithContext(
        <Position x={100} y={200} layer={{ fixed: true }}>
          <div data-testid="inline-fixed-child">Content</div>
        </Position>
      );

      const child = screen.getByTestId('inline-fixed-child');
      const parent = child.parentElement;

      expect(parent).toHaveStyle({
        position: 'absolute',
        left: '100px',
        top: '200px',
      });
    });

    it('应该在没有 CineViewProvider 时正常渲染（静默失败）', () => {
      // Position 组件应该在没有 context 时静默失败，使用默认的 convertSize
      const { container } = render(
        <Position x={100} y={200}>
          <div>Content</div>
        </Position>
      );

      const positionDiv = container.firstChild as HTMLElement;
      expect(positionDiv).toBeInTheDocument();
      // 没有 context 时，convertSize 使用默认实现（直接返回原值）
      expect(positionDiv.style.left).toBe('100px');
      expect(positionDiv.style.top).toBe('200px');
    });
  });

  describe('性能优化', () => {
    it('应该使用 useMemo 缓存位置计算', () => {
      const { rerender } = renderWithContext(
        <Position x={100} y={200}>
          <div data-testid="child">Content</div>
        </Position>
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;
      const initialStyle = parent?.style;

      // 重新渲染但 props 不变
      rerender(
        <CineViewProvider designWidth={750} designHeight={750}>
          <Position x={100} y={200}>
            <div data-testid="child">Content</div>
          </Position>
        </CineViewProvider>
      );

      // 样式对象应该保持一致（由于 useMemo）
      expect(parent?.style).toBe(initialStyle);
    });
  });
});
