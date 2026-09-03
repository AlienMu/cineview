/**
 * Position component unit tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Position } from './Position';
import { CineViewProvider } from '../../context/CineViewContext';
import { CineViewRuntimeContext } from '../runtime/runtimeContext';
import { SceneFixedLayerContext } from './Position';

// Test helper function: create wrapper with Context
const renderWithContext = (
  ui: React.ReactElement,
  options: {
    designSize?: number;
  } = {}
): ReturnType<typeof render> => {
  const designSize = options.designSize ?? 750;
  return render(<CineViewProvider designSize={designSize}>{ui}</CineViewProvider>);
};

describe('Position Component', () => {
  // Set window.innerWidth to 750 before each test, making scale = 1
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

  describe('Absolute positioning calculation', () => {
    it('should correctly calculate absolute X coordinate', () => {
      renderWithContext(
        <Position x={100}>
          <div data-testid="child">Content</div>
        </Position>,
        { designSize: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      expect(parent).toHaveStyle({
        position: 'absolute',
        left: '100px',
        top: '0px',
      });
    });

    it('should correctly calculate absolute Y coordinate', () => {
      renderWithContext(
        <Position y={200}>
          <div data-testid="child">Content</div>
        </Position>,
        { designSize: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      expect(parent).toHaveStyle({
        position: 'absolute',
        left: '0px',
        top: '200px',
      });
    });

    it('should correctly calculate absolute X and Y coordinates', () => {
      renderWithContext(
        <Position x={100} y={200}>
          <div data-testid="child">Content</div>
        </Position>,
        { designSize: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      expect(parent).toHaveStyle({
        position: 'absolute',
        left: '100px',
        top: '200px',
      });
    });

    it('should use px2vw single ruler conversion for Y coordinate, independent of viewportHeight', () => {
      // Both x and y are multiplied by the same scale = viewportWidth / designSize.
      // Here viewportWidth=375, designSize=750 → scale=0.5; viewportHeight does not participate in conversion.
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
        { designSize: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      // Both horizontal and vertical dimensions share scale=0.5: 100→50px, 200→100px.
      expect(parent).toHaveStyle({
        left: '50px',
        top: '100px',
      });
    });

    it('Y coordinate conversion is insensitive to viewportHeight (single ruler proof)', () => {
      // Same viewportWidth=375, designSize=750 → scale=0.5. After changing viewportHeight,
      // under single ruler, top remains 200*0.5=100px.
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 50,
      });

      renderWithContext(
        <Position y={200}>
          <div data-testid="child">Content</div>
        </Position>,
        { designSize: 750 }
      );

      const parent = screen.getByTestId('child').parentElement;
      expect(parent).toHaveStyle({ top: '100px' });
    });

    it('should use default values (0, 0) when no coordinates are provided', () => {
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

  describe('Relative positioning accumulation', () => {
    it('should correctly calculate relative X offset', () => {
      renderWithContext(
        <Position offsetX={50}>
          <div data-testid="child">Content</div>
        </Position>,
        { designSize: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      expect(parent).toHaveStyle({
        position: 'absolute',
        left: '50px',
        top: '0px',
      });
    });

    it('should correctly calculate relative Y offset', () => {
      renderWithContext(
        <Position offsetY={100}>
          <div data-testid="child">Content</div>
        </Position>,
        { designSize: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      expect(parent).toHaveStyle({
        position: 'absolute',
        left: '0px',
        top: '100px',
      });
    });

    it('should correctly accumulate nested relative positioning', () => {
      renderWithContext(
        <Position offsetX={50} offsetY={100}>
          <Position offsetX={30} offsetY={40}>
            <div data-testid="child">Content</div>
          </Position>
        </Position>,
        { designSize: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      // Second layer should accumulate first layer's offset: (50 + 30, 100 + 40)
      expect(parent).toHaveStyle({
        position: 'absolute',
        left: '80px',
        top: '140px',
      });
    });

    it('should correctly accumulate multi-level nested relative positioning', () => {
      renderWithContext(
        <Position offsetX={10} offsetY={20}>
          <Position offsetX={30} offsetY={40}>
            <Position offsetX={50} offsetY={60}>
              <div data-testid="child">Content</div>
            </Position>
          </Position>
        </Position>,
        { designSize: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      // Accumulate all levels: (10 + 30 + 50, 20 + 40 + 60)
      expect(parent).toHaveStyle({
        position: 'absolute',
        left: '90px',
        top: '120px',
      });
    });
  });

  describe('Priority handling', () => {
    it('structural positioning props should override conflicting style positioning, while preserving composable transform', () => {
      renderWithContext(
        <Position
          at={{ x: 100, y: 200 }}
          style={{ position: 'fixed', left: 999, top: 888, transform: 'rotate(10deg)' }}
        >
          <div data-testid="child">Content</div>
        </Position>,
        { designSize: 750 }
      );

      expect(screen.getByTestId('child').parentElement).toHaveStyle({
        position: 'absolute',
        left: '100px',
        top: '200px',
        transform: 'rotate(10deg)',
      });
    });

    it('absolute positioning should take priority over relative positioning (when both x and offsetX exist)', () => {
      renderWithContext(
        <Position x={100} offsetX={50}>
          <div data-testid="child">Content</div>
        </Position>,
        { designSize: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      // Should use absolute positioning x=100, ignoring offsetX=50
      expect(parent).toHaveStyle({
        position: 'absolute',
        left: '100px',
      });
    });

    it('absolute positioning should take priority over relative positioning (when both y and offsetY exist)', () => {
      renderWithContext(
        <Position y={200} offsetY={100}>
          <div data-testid="child">Content</div>
        </Position>,
        { designSize: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      // Should use absolute positioning y=200, ignoring offsetY=100
      expect(parent).toHaveStyle({
        position: 'absolute',
        top: '200px',
      });
    });

    it('absolute positioning should take priority over relative positioning (when all parameters exist)', () => {
      renderWithContext(
        <Position x={100} y={200} offsetX={50} offsetY={100}>
          <div data-testid="child">Content</div>
        </Position>,
        { designSize: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      // Should use absolute positioning, ignoring relative positioning
      expect(parent).toHaveStyle({
        position: 'absolute',
        left: '100px',
        top: '200px',
      });
    });

    it('when nested, child component absolute positioning should ignore parent component position', () => {
      renderWithContext(
        <Position offsetX={50} offsetY={100}>
          <Position x={200} y={300}>
            <div data-testid="child">Content</div>
          </Position>
        </Position>,
        { designSize: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      // Child component uses absolute positioning, not affected by parent component
      expect(parent).toHaveStyle({
        position: 'absolute',
        left: '200px',
        top: '300px',
      });
    });
  });

  describe('Responsive conversion', () => {
    it('should correctly convert based on design size (px unit)', () => {
      // Design size 750px, viewport 750px, ratio 1:1
      renderWithContext(
        <Position x={100} y={200}>
          <div data-testid="child">Content</div>
        </Position>,
        { designSize: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      expect(parent).toHaveStyle({
        left: '100px',
        top: '200px',
      });
    });

    it('should correctly convert based on design size (different design size)', () => {
      // Design size 375px, viewport 750px, scale = 750/375 = 2
      renderWithContext(
        <Position x={100} y={200}>
          <div data-testid="child">Content</div>
        </Position>,
        { designSize: 375 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      // 100 * 2 = 200, 200 * 2 = 400
      expect(parent).toHaveStyle({
        left: '200px',
        top: '400px',
      });
    });

    it('should correctly handle decimal values', () => {
      renderWithContext(
        <Position x={100.5} y={200.75}>
          <div data-testid="child">Content</div>
        </Position>,
        { designSize: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      expect(parent).toHaveStyle({
        left: '100.5px',
        top: '200.75px',
      });
    });
  });

  describe('Boundary value handling', () => {
    it('should correctly handle zero values', () => {
      renderWithContext(
        <Position x={0} y={0}>
          <div data-testid="child">Content</div>
        </Position>,
        { designSize: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      expect(parent).toHaveStyle({
        left: '0px',
        top: '0px',
      });
    });

    it('should correctly handle negative values', () => {
      renderWithContext(
        <Position x={-50} y={-100}>
          <div data-testid="child">Content</div>
        </Position>,
        { designSize: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      expect(parent).toHaveStyle({
        left: '-50px',
        top: '-100px',
      });
    });

    it('should correctly handle large numeric values', () => {
      renderWithContext(
        <Position x={10000} y={20000}>
          <div data-testid="child">Content</div>
        </Position>,
        { designSize: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      expect(parent).toHaveStyle({
        left: '10000px',
        top: '20000px',
      });
    });

    it('should correctly handle negative value accumulation in relative positioning', () => {
      renderWithContext(
        <Position offsetX={100} offsetY={200}>
          <Position offsetX={-50} offsetY={-100}>
            <div data-testid="child">Content</div>
          </Position>
        </Position>,
        { designSize: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      // Accumulate: (100 - 50, 200 - 100)
      expect(parent).toHaveStyle({
        left: '50px',
        top: '100px',
      });
    });
  });

  describe('Window resize response', () => {
    it('should recalculate position after window resize', async () => {
      // Note: Since resize event uses debounce, actual testing requires waiting
      // Here we mainly test whether the component correctly uses convertSize from Context
      const { rerender } = renderWithContext(
        <Position x={100} y={200}>
          <div data-testid="child">Content</div>
        </Position>,
        { designSize: 750 }
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;

      expect(parent).toHaveStyle({
        left: '100px',
        top: '200px',
      });

      // Re-render to simulate Context update
      rerender(
        <CineViewProvider designSize={750}>
          <Position x={100} y={200}>
            <div data-testid="child">Content</div>
          </Position>
        </CineViewProvider>
      );

      // Position should remain consistent (because design size hasn't changed)
      expect(parent).toHaveStyle({
        left: '100px',
        top: '200px',
      });
    });
  });

  describe('Centering positioning (anchor)', () => {
    it('anchor=center centers both horizontally and vertically (left/top=50% + translate(-50%))', () => {
      renderWithContext(
        <Position at={{ anchor: 'center' }}>
          <div data-testid="child">Content</div>
        </Position>,
        { designSize: 750 }
      );

      const parent = screen.getByTestId('child').parentElement;
      expect(parent).toHaveStyle({
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translateX(-50%) translateY(-50%)',
      });
    });

    it('anchor=center-x only centers horizontally, y remains absolute coordinate', () => {
      renderWithContext(
        <Position at={{ anchor: 'center-x', y: 200 }}>
          <div data-testid="child">Content</div>
        </Position>,
        { designSize: 750 }
      );

      const parent = screen.getByTestId('child').parentElement;
      expect(parent).toHaveStyle({
        left: '50%',
        top: '200px',
        transform: 'translateX(-50%)',
      });
    });

    it('anchor=center-y only centers vertically, x remains absolute coordinate', () => {
      renderWithContext(
        <Position at={{ anchor: 'center-y', x: 100 }}>
          <div data-testid="child">Content</div>
        </Position>,
        { designSize: 750 }
      );

      const parent = screen.getByTestId('child').parentElement;
      expect(parent).toHaveStyle({
        left: '100px',
        top: '50%',
        transform: 'translateY(-50%)',
      });
    });

    it('after centering, x/y can still set offset relative to center (calc(50% + offset))', () => {
      renderWithContext(
        <Position at={{ anchor: 'center', x: 40, y: -30 }}>
          <div data-testid="child">Content</div>
        </Position>,
        { designSize: 750 }
      );

      const parent = screen.getByTestId('child').parentElement;
      expect(parent).toHaveStyle({
        left: 'calc(50% + 40px)',
        top: 'calc(50% + -30px)',
        transform: 'translateX(-50%) translateY(-50%)',
      });
    });

    it('centering transform combines with user-defined transform (centering comes first)', () => {
      renderWithContext(
        <Position at={{ anchor: 'center' }} style={{ transform: 'rotate(10deg)' }}>
          <div data-testid="child">Content</div>
        </Position>,
        { designSize: 750 }
      );

      const parent = screen.getByTestId('child').parentElement;
      expect(parent).toHaveStyle({
        transform: 'translateX(-50%) translateY(-50%) rotate(10deg)',
      });
    });
  });

  describe('Child element rendering', () => {
    it('should correctly render child elements', () => {
      renderWithContext(
        <Position x={100} y={200}>
          <div data-testid="child">Test Content</div>
        </Position>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should correctly render multiple child elements', () => {
      renderWithContext(
        <Position x={100} y={200}>
          <div data-testid="child1">Content 1</div>
          <div data-testid="child2">Content 2</div>
        </Position>
      );

      expect(screen.getByTestId('child1')).toBeInTheDocument();
      expect(screen.getByTestId('child2')).toBeInTheDocument();
    });

    it('should correctly render nested Position components', () => {
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

  describe('Context propagation', () => {
    it('should correctly propagate position context to child Position components', () => {
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

      // Parent component uses absolute positioning
      expect(parentContainer).toHaveStyle({
        left: '100px',
        top: '200px',
      });

      // Child component should perform relative positioning based on parent component's absolute position
      // But since parent component uses absolute positioning, child component's relative positioning starts from (100, 200)
      expect(childContainer).toHaveStyle({
        left: '150px', // 100 + 50
        top: '300px', // 200 + 100
      });
    });
  });

  describe('Error handling', () => {
    it('in scroll mode, should prioritize portaling fixed layers inside scene to scene host', () => {
      const fixedHost = document.createElement('div');
      document.body.appendChild(fixedHost);
      const { container } = renderWithContext(
        <CineViewRuntimeContext.Provider value={{ mode: 'scroll' }}>
          <SceneFixedLayerContext.Provider value={fixedHost}>
            <Position x={100} y={200} fixed>
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

    it('in scroll mode, should keep fixed layers without scene host as sticky', () => {
      renderWithContext(
        <CineViewRuntimeContext.Provider value={{ mode: 'scroll' }}>
          <section data-testid="ordinary-region">
            <Position x={64} y={128} fixed>
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

    it('should retain fixed content when there is no scene host, rather than disappearing directly', () => {
      renderWithContext(
        <Position x={100} y={200} fixed>
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

    it('should render normally without CineViewProvider (silent failure)', () => {
      // Position component should fail silently when there is no context, using default convertSize
      const { container } = render(
        <Position x={100} y={200}>
          <div>Content</div>
        </Position>
      );

      const positionDiv = container.firstChild as HTMLElement;
      expect(positionDiv).toBeInTheDocument();
      // Without context, convertSize uses default implementation (directly returns original value)
      expect(positionDiv.style.left).toBe('100px');
      expect(positionDiv.style.top).toBe('200px');
    });
  });

  describe('Performance optimization', () => {
    it('should use useMemo to cache position calculation', () => {
      const { rerender } = renderWithContext(
        <Position x={100} y={200}>
          <div data-testid="child">Content</div>
        </Position>
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;
      const initialStyle = parent?.style;

      // Re-render but props unchanged
      rerender(
        <CineViewProvider designSize={750}>
          <Position x={100} y={200}>
            <div data-testid="child">Content</div>
          </Position>
        </CineViewProvider>
      );

      // Style object should remain consistent (due to useMemo)
      expect(parent?.style).toBe(initialStyle);
    });
  });
});
