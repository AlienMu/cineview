/**
 * Container 组件单元测试
 */

import { render } from '@testing-library/react';
import { Container } from './Container';
import { CineViewProvider } from '../../context/CineViewContext';

const defaultProviderProps = {
  designWidth: 750,
  designHeight: 800,
  unit: 'px' as 'px' | 'rem' | 'vw',
};

function renderWithCineView(
  ui: React.ReactNode,
  providerProps?: Partial<typeof defaultProviderProps>
) {
  return render(
    <CineViewProvider {...defaultProviderProps} {...providerProps}>
      {ui}
    </CineViewProvider>
  );
}

describe('Container', () => {
  describe('基础功能', () => {
    it('应该正确渲染子元素', () => {
      const { getByText } = renderWithCineView(
        <Container>
          <div>Test Content</div>
        </Container>
      );

      expect(getByText('Test Content')).toBeInTheDocument();
    });

    it('应该应用自定义 className', () => {
      const { container } = renderWithCineView(
        <Container className="custom-class">
          <div>Content</div>
        </Container>
      );

      // CineViewProvider 包装了一层 div，Container 是第二层
      const containerDiv = container.querySelector('.custom-class') as HTMLElement;
      expect(containerDiv).toBeInTheDocument();
      expect(containerDiv).toHaveClass('custom-class');
    });

    it('应该合并自定义样式', () => {
      const customStyle = { backgroundColor: 'red', padding: '10px' };
      const { container } = renderWithCineView(
        <Container style={customStyle} className="test-container">
          <div>Content</div>
        </Container>
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
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 400,
      });

      const { getByTestId } = renderWithCineView(
        <Container width={200} data-testid="container">
          <div>Content</div>
        </Container>
      );

      const containerDiv = getByTestId('container');
      expect(containerDiv).toHaveStyle({ width: '100px' });
    });

    it('应该在 px 单位模式下换算高度', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 400,
      });

      const { getByTestId } = renderWithCineView(
        <Container height={400} data-testid="container">
          <div>Content</div>
        </Container>
      );

      const containerDiv = getByTestId('container');
      expect(containerDiv).toHaveStyle({ height: '200px' });
    });

    it('应该同时换算宽度和高度', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 400,
      });

      const { getByTestId } = renderWithCineView(
        <Container width={300} height={600} data-testid="container">
          <div>Content</div>
        </Container>
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
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 400,
      });

      const { getByTestId } = renderWithCineView(
        <Container width={100} data-testid="container">
          <div>Content</div>
        </Container>,
        { unit: 'rem' }
      );

      const containerDiv = getByTestId('container');
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
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 400,
      });

      const { getByTestId } = renderWithCineView(
        <Container height={200} data-testid="container">
          <div>Content</div>
        </Container>
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
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 400,
      });

      const { getByTestId } = renderWithCineView(
        <Container width={200} data-testid="container">
          <div>Content</div>
        </Container>
      );

      const containerDiv = getByTestId('container');
      expect(containerDiv.style.height).toBe('');
      expect(containerDiv).toHaveStyle({ width: '100px' });
    });

    it('应该在未指定宽高时只应用自定义样式', () => {
      const customStyle = { display: 'flex' };
      const { getByTestId } = renderWithCineView(
        <Container style={customStyle} data-testid="container">
          <div>Content</div>
        </Container>
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
      const { getByTestId } = renderWithCineView(
        <Container width={0} data-testid="container">
          <div>Content</div>
        </Container>
      );

      const containerDiv = getByTestId('container');
      expect(containerDiv).toHaveStyle({ width: '0px' });
    });

    it('应该处理高度为 0 的情况', () => {
      const { getByTestId } = renderWithCineView(
        <Container height={0} data-testid="container">
          <div>Content</div>
        </Container>
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
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 400,
      });

      const { getByTestId } = renderWithCineView(
        <Container width={10000} height={10000} data-testid="container">
          <div>Content</div>
        </Container>
      );

      const containerDiv = getByTestId('container');
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
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 400,
      });

      const { getByTestId } = renderWithCineView(
        <Container width={400} data-testid="outer">
          <Container width={200} data-testid="inner">
            <div>Nested Content</div>
          </Container>
        </Container>
      );

      const outerContainer = getByTestId('outer');
      const innerContainer = getByTestId('inner');

      expect(outerContainer).toHaveStyle({ width: '200px' });
      expect(innerContainer).toHaveStyle({ width: '100px' });
    });
  });
});
