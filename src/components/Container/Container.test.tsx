/**
 * Container component unit tests
 */

import { render } from '@testing-library/react';
import { Container } from './Container';
import { CineViewProvider } from '../../context/CineViewContext';

const defaultProviderProps = {
  designSize: 750,
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
  describe('Basic functionality', () => {
    it('should render children correctly', () => {
      const { getByText } = renderWithCineView(
        <Container>
          <div>Test Content</div>
        </Container>
      );

      expect(getByText('Test Content')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = renderWithCineView(
        <Container className="custom-class">
          <div>Content</div>
        </Container>
      );

      // CineViewProvider wraps with a div, Container is the second layer
      const containerDiv = container.querySelector('.custom-class') as HTMLElement;
      expect(containerDiv).toBeInTheDocument();
      expect(containerDiv).toHaveClass('custom-class');
    });

    it('should merge custom styles', () => {
      const customStyle = { backgroundColor: 'red', padding: '10px' };
      const { container } = renderWithCineView(
        <Container style={customStyle} className="test-container">
          <div>Content</div>
        </Container>
      );

      const containerDiv = container.querySelector('.test-container') as HTMLElement;
      // Assert the inline style the component actually wrote, not the computed
      // value. `toHaveStyle({ backgroundColor: 'red' })` used to pass because the
      // old jsdom echoed the keyword back; the newer one resolves it to
      // `rgb(255, 0, 0)` and jest-dom no longer normalises the keyword, so that
      // form fails for a reason that has nothing to do with style merging.
      expect(containerDiv.style.backgroundColor).toBe('red');
      expect(containerDiv.style.padding).toBe('10px');
    });
  });

  describe('Responsive size conversion', () => {
    it('should convert width in px unit mode', () => {
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

    it('should convert height in px unit mode', () => {
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

    it('should convert both width and height', () => {
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

    it('should convert box model lengths (padding/borderRadius/fontSize) with the same scale', () => {
      // px2vw single scale: viewport width 375 / design 750 → scale 0.5, all length dimensions share this ratio.
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
      // width 100→50, padding 40→20, borderRadius 20→10, fontSize 32→16 (all multiplied by 0.5).
      expect(containerDiv).toHaveStyle({
        width: '50px',
        padding: '20px',
        borderRadius: '10px',
        fontSize: '16px',
      });
    });

    it('width/height convenience props should override conflicting sizes in style', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      const { getByTestId } = renderWithCineView(
        <Container
          width={200}
          height={100}
          style={{ width: 600, height: 500, padding: 20 }}
          data-testid="container"
        >
          <div>Content</div>
        </Container>
      );

      expect(getByTestId('container')).toHaveStyle({
        width: '100px',
        height: '50px',
        padding: '10px',
      });
    });
  });

  describe('Optional parameters', () => {
    it('should not set width style when unspecified', () => {
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

    it('should not set height style when unspecified', () => {
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

    it('should apply only custom styles when width and height are unspecified', () => {
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

  describe('Error handling', () => {
    it('should throw error when used outside CineView (development environment)', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      // Mock console.error to avoid error output in test logs
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

    it('should silently pass through original style without conversion when context is missing in production (no throw)', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // In production, missing context does not throw; takes `return style` branch: width/height
      // convenience props are not converted (no scale available), only the passed-in style is preserved.
      const { getByTestId } = render(
        <Container width={200} style={{ padding: 10 }} data-testid="container">
          <div>Content</div>
        </Container>
      );

      const containerDiv = getByTestId('container');
      // No context: no width conversion value generated, padding retains original number (React appends px).
      expect(containerDiv.style.width).toBe('');
      expect(containerDiv).toHaveStyle({ padding: '10px' });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Edge cases', () => {
    it('should handle width of 0', () => {
      const { getByTestId } = renderWithCineView(
        <Container width={0} data-testid="container">
          <div>Content</div>
        </Container>
      );

      const containerDiv = getByTestId('container');
      expect(containerDiv).toHaveStyle({ width: '0px' });
    });

    it('should handle height of 0', () => {
      const { getByTestId } = renderWithCineView(
        <Container height={0} data-testid="container">
          <div>Content</div>
        </Container>
      );

      const containerDiv = getByTestId('container');
      expect(containerDiv).toHaveStyle({ height: '0px' });
    });

    it('should handle very large size values', () => {
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

  describe('Nested usage', () => {
    it('should support nested Containers', () => {
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
