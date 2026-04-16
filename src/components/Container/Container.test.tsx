/**
 * Container 组件单元测试
 */

import { render } from '@testing-library/react';
import { Container } from './Container';
import { CineViewProvider } from '../../context/CineViewContext';

describe('Container', () => {
  describe('基础功能', () => {
    it('应该正确渲染子元素', () => {
      const { getByText } = render(
        <CineViewProvider designSize={750} unit="px">
          <Container>
            <div>Test Content</div>
          </Container>
        </CineViewProvider>
      );

      expect(getByText('Test Content')).toBeInTheDocument();
    });

    it('应该应用自定义 className', () => {
      const { container } = render(
        <CineViewProvider designSize={750} unit="px">
          <Container className="custom-class">
            <div>Content</div>
          </Container>
        </CineViewProvider>
      );

      // CineViewProvider 包装了一层 div，Container 是第二层
      const containerDiv = container.querySelector('.custom-class') as HTMLElement;
      expect(containerDiv).toBeInTheDocument();
      expect(containerDiv).toHaveClass('custom-class');
    });

    it('应该合并自定义样式', () => {
      const customStyle = { backgroundColor: 'red', padding: '10px' };
      const { container } = render(
        <CineViewProvider designSize={750} unit="px">
          <Container style={customStyle} className="test-container">
            <div>Content</div>
          </Container>
        </CineViewProvider>
      );

      const containerDiv = container.querySelector('.test-container') as HTMLElement;
      expect(containerDiv).toHaveStyle({
        backgroundColor: 'red',
        padding: '10px',
      });
    });
  });

  describe('响应式尺寸换算', () => {
    it('应该在 px 单位模式下进行换算', () => {
      // 设置 window.innerWidth 为 375
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      const { getByTestId } = render(
        <CineViewProvider designSize={750} unit="px">
          <Container width={200} data-testid="container">
            <div>Content</div>
          </Container>
        </CineViewProvider>
      );

      const containerDiv = getByTestId('container');
      // scale = 375 / 750 = 0.5, 200 * 0.5 = 100px
      expect(containerDiv).toHaveStyle({ width: '100px' });
    });

    it('应该在 px 单位模式下换算高度', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      const { getByTestId } = render(
        <CineViewProvider designSize={750} unit="px">
          <Container height={400} data-testid="container">
            <div>Content</div>
          </Container>
        </CineViewProvider>
      );

      const containerDiv = getByTestId('container');
      // scale = 375 / 750 = 0.5, 400 * 0.5 = 200px
      expect(containerDiv).toHaveStyle({ height: '200px' });
    });

    it('应该同时换算宽度和高度', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      const { getByTestId } = render(
        <CineViewProvider designSize={750} unit="px">
          <Container width={300} height={600} data-testid="container">
            <div>Content</div>
          </Container>
        </CineViewProvider>
      );

      const containerDiv = getByTestId('container');
      expect(containerDiv).toHaveStyle({
        width: '150px',
        height: '300px',
      });
    });

    it('应该在 rem 单位模式下进行换算', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      const { getByTestId } = render(
        <CineViewProvider designSize={750} unit="rem">
          <Container width={100} data-testid="container">
            <div>Content</div>
          </Container>
        </CineViewProvider>
      );

      const containerDiv = getByTestId('container');
      // rem 模式：scale = 375 / 750 = 0.5, 100 * 0.5 = 50px
      expect(containerDiv).toHaveStyle({ width: '50px' });
    });
  });

  describe('可选参数', () => {
    it('应该在未指定宽度时不设置 width 样式', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      const { getByTestId } = render(
        <CineViewProvider designSize={750} unit="px">
          <Container height={200} data-testid="container">
            <div>Content</div>
          </Container>
        </CineViewProvider>
      );

      const containerDiv = getByTestId('container');
      expect(containerDiv.style.width).toBe('');
      expect(containerDiv).toHaveStyle({ height: '100px' });
    });

    it('应该在未指定高度时不设置 height 样式', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      const { getByTestId } = render(
        <CineViewProvider designSize={750} unit="px">
          <Container width={200} data-testid="container">
            <div>Content</div>
          </Container>
        </CineViewProvider>
      );

      const containerDiv = getByTestId('container');
      expect(containerDiv.style.height).toBe('');
      expect(containerDiv).toHaveStyle({ width: '100px' });
    });

    it('应该在未指定宽高时只应用自定义样式', () => {
      const customStyle = { display: 'flex' };
      const { getByTestId } = render(
        <CineViewProvider designSize={750} unit="px">
          <Container style={customStyle} data-testid="container">
            <div>Content</div>
          </Container>
        </CineViewProvider>
      );

      const containerDiv = getByTestId('container');
      expect(containerDiv.style.width).toBe('');
      expect(containerDiv.style.height).toBe('');
      expect(containerDiv).toHaveStyle({ display: 'flex' });
    });
  });

  describe('错误处理', () => {
    it('应该在不在 CineView 下使用时抛出错误（开发环境）', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      // 使用 console.error mock 来避免测试输出中的错误信息
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(
          <Container width={200}>
            <div>Content</div>
          </Container>
        );
      }).toThrow('[CineView] Container must be used within a CineView component');

      consoleError.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('边界情况', () => {
    it('应该处理宽度为 0 的情况', () => {
      const { getByTestId } = render(
        <CineViewProvider designSize={750} unit="px">
          <Container width={0} data-testid="container">
            <div>Content</div>
          </Container>
        </CineViewProvider>
      );

      const containerDiv = getByTestId('container');
      expect(containerDiv).toHaveStyle({ width: '0px' });
    });

    it('应该处理高度为 0 的情况', () => {
      const { getByTestId } = render(
        <CineViewProvider designSize={750} unit="px">
          <Container height={0} data-testid="container">
            <div>Content</div>
          </Container>
        </CineViewProvider>
      );

      const containerDiv = getByTestId('container');
      expect(containerDiv).toHaveStyle({ height: '0px' });
    });

    it('应该处理非常大的尺寸值', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      const { getByTestId } = render(
        <CineViewProvider designSize={750} unit="px">
          <Container width={10000} height={10000} data-testid="container">
            <div>Content</div>
          </Container>
        </CineViewProvider>
      );

      const containerDiv = getByTestId('container');
      // scale = 375 / 750 = 0.5, 10000 * 0.5 = 5000px
      expect(containerDiv).toHaveStyle({
        width: '5000px',
        height: '5000px',
      });
    });
  });

  describe('嵌套使用', () => {
    it('应该支持嵌套 Container', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      const { getByTestId } = render(
        <CineViewProvider designSize={750} unit="px">
          <Container width={400} data-testid="outer">
            <Container width={200} data-testid="inner">
              <div>Nested Content</div>
            </Container>
          </Container>
        </CineViewProvider>
      );

      const outerContainer = getByTestId('outer');
      const innerContainer = getByTestId('inner');

      // scale = 375 / 750 = 0.5
      expect(outerContainer).toHaveStyle({ width: '200px' });
      expect(innerContainer).toHaveStyle({ width: '100px' });
    });
  });
});
