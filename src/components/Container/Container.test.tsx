/**
 * Container 组件单元测试
 */

import { render } from '@testing-library/react';
import { Container } from './Container';
import { CineViewProvider } from '../../context/CineViewContext';

const defaultProviderProps = {
  designWidth: 750,
  designHeight: 800,
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

    it('应该把 style 里的盒模型长度（padding/borderRadius/fontSize）按同一 scale 换算', () => {
      // px2vw 单尺子：width 375 / design 750 → scale 0.5，所有长度量共用。
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
        <Container
          width={100}
          style={{ padding: 40, borderRadius: 20, fontSize: 32 }}
          data-testid="container"
        >
          <div>Content</div>
        </Container>
      );

      const containerDiv = getByTestId('container');
      // width 100→50、padding 40→20、borderRadius 20→10、fontSize 32→16（全乘 0.5）。
      expect(containerDiv).toHaveStyle({
        width: '50px',
        padding: '20px',
        borderRadius: '10px',
        fontSize: '16px',
      });
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

    it('应该在生产环境无 context 时静默透传原样 style（不换算、不抛错）', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // production 下 !context 不抛错，走 `return style` 分支：width/height 便捷属性
      // 不换算（无 scale 可用），仅原样保留传入的 style。
      const { getByTestId } = render(
        <Container width={200} style={{ padding: 10 }} data-testid="container">
          <div>Content</div>
        </Container>
      );

      const containerDiv = getByTestId('container');
      // 无 context：不产生 width 换算值，padding 保持原始数字（React 补 px）。
      expect(containerDiv.style.width).toBe('');
      expect(containerDiv).toHaveStyle({ padding: '10px' });

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
