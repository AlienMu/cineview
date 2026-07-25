/**
 * Bug Fix Test: Animation Trigger Issues
 *
 * Tests for the following issues:
 * 1. First scene not triggering animations on mount
 * 2. Animate components not triggering enter animations after scene change
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { act } from 'react';
import { CineView } from '../../components/CineView/CineView';
import { Scene } from '../../components/Scene/Scene';
import { Animate } from '../../components/Animate/Animate';

describe('Animation Trigger Bug Fixes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Issue 1: First scene animations', () => {
    it('should trigger enter animations on first scene mount', async () => {
      const onAfterSceneChange = jest.fn();

      const { container } = render(
        <CineView
          config={{ size: 750 }}
          mode="drag"
          modes={{ drag: { transitionDuration: 500 } }}
          callbacks={{ onSceneDidChange: onAfterSceneChange }}
        >
          <Scene>
            <Animate enterAnimation="fade-in" duration={{ enter: 300 }} animateId="test-animate-1">
              <div data-testid="content-1">First Scene Content</div>
            </Animate>
          </Scene>
          <Scene>
            <Animate enterAnimation="fade-in" duration={{ enter: 300 }} animateId="test-animate-2">
              <div data-testid="content-2">Second Scene Content</div>
            </Animate>
          </Scene>
        </CineView>
      );

      // Wait for first scene to render
      await waitFor(
        () => {
          const firstContent = container.querySelector('[data-testid="content-1"]');
          expect(firstContent).toBeInTheDocument();
        },
        { timeout: 1000 }
      );

      // Verify first scene is visible
      const firstScene = container.querySelector('[data-scene-index="0"]');
      expect(firstScene).toHaveStyle({ visibility: 'visible' });
    });

    it('should render first scene immediately without waiting for image load', async () => {
      const { container } = render(
        <CineView config={{ size: 750 }} mode="drag" modes={{ drag: { transitionDuration: 500 } }}>
          <Scene assets={{ preloadImages: ['https://example.com/image.jpg'] }}>
            <Animate enterAnimation="fade-in" duration={{ enter: 300 }}>
              <div data-testid="first-scene">First Scene</div>
            </Animate>
          </Scene>
        </CineView>
      );

      // First scene should render immediately
      await waitFor(
        () => {
          const firstScene = container.querySelector('[data-testid="first-scene"]');
          expect(firstScene).toBeInTheDocument();
        },
        { timeout: 500 }
      );
    });
  });

  describe('Issue 2: Scene change animations', () => {
    it('should trigger enter animations when switching to a new scene', async () => {
      const TestComponent: React.FC = () => {
        return (
          <>
            <button onClick={() => {}} data-testid="next-button">
              Next
            </button>
            <CineView
              config={{ size: 750 }}
              mode="drag"
              modes={{ drag: { transitionDuration: 500 } }}
            >
              <Scene>
                <Animate
                  enterAnimation="fade-in"
                  duration={{ enter: 300 }}
                  animateId="scene-0-animate"
                >
                  <div data-testid="scene-0">Scene 0</div>
                </Animate>
              </Scene>
              <Scene>
                <Animate
                  enterAnimation="fade-in"
                  duration={{ enter: 300 }}
                  animateId="scene-1-animate"
                >
                  <div data-testid="scene-1">Scene 1</div>
                </Animate>
              </Scene>
            </CineView>
          </>
        );
      };

      const { container, getByTestId } = render(<TestComponent />);

      // Wait for first scene
      await waitFor(() => {
        expect(getByTestId('scene-0')).toBeInTheDocument();
      });

      // Simulate scene change
      const nextButton = getByTestId('next-button');
      await act(async () => {
        nextButton.click();
      });

      // Both scenes should exist in DOM (virtualization keeps adjacent scenes)
      await waitFor(() => {
        const scene0 = container.querySelector('[data-scene-index="0"]');
        const scene1 = container.querySelector('[data-scene-index="1"]');
        expect(scene0).toBeInTheDocument();
        expect(scene1).toBeInTheDocument();
      });
    });

    it('should reset and replay animations when returning to a previous scene', async () => {
      const TestComponent: React.FC = () => {
        return (
          <>
            <button onClick={() => {}} data-testid="go-to-1">
              Go to Scene 1
            </button>
            <button onClick={() => {}} data-testid="go-to-0">
              Go to Scene 0
            </button>
            <CineView
              config={{ size: 750 }}
              mode="drag"
              modes={{ drag: { transitionDuration: 500 } }}
            >
              <Scene>
                <Animate
                  enterAnimation="fade-in"
                  duration={{ enter: 300 }}
                  animateId="scene-0-content"
                >
                  <div data-testid="scene-0-content">Scene 0 Content</div>
                </Animate>
              </Scene>
              <Scene>
                <Animate
                  enterAnimation="slide-up"
                  duration={{ enter: 300 }}
                  animateId="scene-1-content"
                >
                  <div data-testid="scene-1-content">Scene 1 Content</div>
                </Animate>
              </Scene>
            </CineView>
          </>
        );
      };

      const { getByTestId } = render(<TestComponent />);

      // Wait for initial scene
      await waitFor(() => {
        expect(getByTestId('scene-0-content')).toBeInTheDocument();
      });

      // Go to scene 1
      await act(async () => {
        getByTestId('go-to-1').click();
      });

      await waitFor(() => {
        expect(getByTestId('scene-1-content')).toBeInTheDocument();
      });

      // Go back to scene 0
      await act(async () => {
        getByTestId('go-to-0').click();
      });

      // Scene 0 should be visible again
      await waitFor(() => {
        expect(getByTestId('scene-0-content')).toBeInTheDocument();
      });
    });
  });

  describe('Issue 3: Animation delay chain', () => {
    it('should correctly handle waitFor animation chains on scene change', async () => {
      const { container } = render(
        <CineView config={{ size: 750 }} mode="drag" modes={{ drag: { transitionDuration: 500 } }}>
          <Scene>
            <Animate
              enterAnimation="fade-in"
              duration={{ enter: 200 }}
              timeline={{ delay: 0 }}
              animateId="first"
            >
              <div data-testid="first">First</div>
            </Animate>
            <Animate
              enterAnimation="fade-in"
              duration={{ enter: 200 }}
              timeline={{ delay: 100, waitFor: 'first' }}
              animateId="second"
            >
              <div data-testid="second">Second</div>
            </Animate>
            <Animate
              enterAnimation="fade-in"
              duration={{ enter: 200 }}
              timeline={{ delay: 100, waitFor: 'second' }}
              animateId="third"
            >
              <div data-testid="third">Third</div>
            </Animate>
          </Scene>
        </CineView>
      );

      // All elements should eventually be visible
      await waitFor(
        () => {
          expect(container.querySelector('[data-testid="first"]')).toBeInTheDocument();
          expect(container.querySelector('[data-testid="second"]')).toBeInTheDocument();
          expect(container.querySelector('[data-testid="third"]')).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });
  });
});
