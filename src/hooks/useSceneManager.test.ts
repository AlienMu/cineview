/**
 * useSceneManager Hook Tests
 */

import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { useSceneManager } from './useSceneManager';

describe('useSceneManager', () => {
  describe('initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
        })
      );

      const [state] = result.current;

      expect(state.currentScene).toBe(0);
      expect(state.isAnimating).toBe(false);
      expect(state.direction).toBeNull();
    });

    it('should initialize with custom initial scene', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          initialScene: 2,
        })
      );

      const [state] = result.current;

      expect(state.currentScene).toBe(2);
    });

    it('should clamp initial scene to valid range', () => {
      const { result: result1 } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          initialScene: -1,
        })
      );

      expect(result1.current[0].currentScene).toBe(0);

      const { result: result2 } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          initialScene: 10,
        })
      );

      expect(result2.current[0].currentScene).toBe(4);
    });

    it('should accept mode option', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          mode: 'drag',
        })
      );

      expect(result.current).toBeDefined();
    });
  });

  describe('canGoNext and canGoPrev', () => {
    it('should correctly determine if can go next', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 3,
          initialScene: 0,
        })
      );

      const [, actions] = result.current;

      expect(actions.canGoNext()).toBe(true);
      expect(actions.canGoPrev()).toBe(false);
    });

    it('should correctly determine if can go prev', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 3,
          initialScene: 2,
        })
      );

      const [, actions] = result.current;

      expect(actions.canGoNext()).toBe(false);
      expect(actions.canGoPrev()).toBe(true);
    });

    it('should handle middle scene', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          initialScene: 2,
        })
      );

      const [, actions] = result.current;

      expect(actions.canGoNext()).toBe(true);
      expect(actions.canGoPrev()).toBe(true);
    });

    it('should handle single scene', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 1,
          initialScene: 0,
        })
      );

      const [, actions] = result.current;

      expect(actions.canGoNext()).toBe(false);
      expect(actions.canGoPrev()).toBe(false);
    });
  });

  describe('goToScene', () => {
    it('should navigate to specified scene', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(3);
      });

      const [state] = result.current;
      expect(state.currentScene).toBe(3);
      expect(state.direction).toBe('forward');
    });

    it('should set backward direction when going to previous scene', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          initialScene: 3,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(1);
      });

      const [state] = result.current;
      expect(state.currentScene).toBe(1);
      expect(state.direction).toBe('backward');
    });

    it('should call onBeforeChange callback', () => {
      const onBeforeChange = jest.fn();

      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          initialScene: 0,
          onBeforeChange,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(2);
      });

      expect(onBeforeChange).toHaveBeenCalledWith(0, 2);
    });

    it('should call onAfterChange when animated is false', () => {
      const onAfterChange = jest.fn();

      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          onAfterChange,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(2, false);
      });

      expect(onAfterChange).toHaveBeenCalledWith(2);
    });

    it('should set isAnimating when animated is true', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(2, true);
      });

      const [state] = result.current;
      expect(state.isAnimating).toBe(true);
    });

    it('should not animate when animated is false', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(2, false);
      });

      const [state] = result.current;
      expect(state.isAnimating).toBe(false);
    });

    it('should warn for invalid scene index (negative)', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(-1);
      });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid scene index: -1'));

      consoleSpy.mockRestore();
    });

    it('should warn for invalid scene index (too large)', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(10);
      });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid scene index: 10'));

      consoleSpy.mockRestore();
    });

    it('should not change scene if already at target', () => {
      const onBeforeChange = jest.fn();

      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          initialScene: 2,
          onBeforeChange,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(2);
      });

      expect(onBeforeChange).not.toHaveBeenCalled();
    });

    it('should block new transitions in snap mode while animating', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          mode: 'snap',
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(1, true);
      });

      const [state1] = result.current;
      expect(state1.currentScene).toBe(1);
      expect(state1.isAnimating).toBe(true);

      // Try to navigate while animating
      act(() => {
        const [, actions] = result.current;
        actions.goToScene(3, true);
      });

      const [state2] = result.current;
      // Should still be at scene 1
      expect(state2.currentScene).toBe(1);
    });

    it('should allow transitions in drag mode while animating', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          mode: 'drag',
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(1, true);
      });

      const [state1] = result.current;
      expect(state1.currentScene).toBe(1);

      // Try to navigate while animating (should work in drag mode)
      act(() => {
        const [, actions] = result.current;
        actions.goToScene(3, true);
      });

      const [state2] = result.current;
      expect(state2.currentScene).toBe(3);
    });
  });

  describe('nextScene', () => {
    it('should navigate to next scene', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          initialScene: 1,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.nextScene();
      });

      const [state] = result.current;
      expect(state.currentScene).toBe(2);
    });

    it('should not navigate beyond last scene', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          initialScene: 4,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.nextScene();
      });

      const [state] = result.current;
      expect(state.currentScene).toBe(4);
    });
  });

  describe('prevScene', () => {
    it('should navigate to previous scene', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          initialScene: 2,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.prevScene();
      });

      const [state] = result.current;
      expect(state.currentScene).toBe(1);
    });

    it('should not navigate before first scene', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          initialScene: 0,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.prevScene();
      });

      const [state] = result.current;
      expect(state.currentScene).toBe(0);
    });
  });

  describe('setAnimating', () => {
    it('should update animating state', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.setAnimating(true);
      });

      const [state1] = result.current;
      expect(state1.isAnimating).toBe(true);

      act(() => {
        const [, actions] = result.current;
        actions.setAnimating(false);
      });

      const [state2] = result.current;
      expect(state2.isAnimating).toBe(false);
    });

    it('should call onAfterChange when animation ends', () => {
      const onAfterChange = jest.fn();

      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          initialScene: 2,
          onAfterChange,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.setAnimating(true);
      });

      expect(onAfterChange).not.toHaveBeenCalled();

      act(() => {
        const [, actions] = result.current;
        actions.setAnimating(false);
      });

      expect(onAfterChange).toHaveBeenCalledWith(2);
    });

    it('should clear direction when animation ends', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(2, true);
      });

      const [state1] = result.current;
      expect(state1.direction).toBe('forward');

      act(() => {
        const [, actions] = result.current;
        actions.setAnimating(false);
      });

      const [state2] = result.current;
      expect(state2.direction).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle zero scenes', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 0,
        })
      );

      const [state, actions] = result.current;

      expect(state.currentScene).toBe(0);
      expect(actions.canGoNext()).toBe(false);
      expect(actions.canGoPrev()).toBe(false);
    });

    it('should handle rapid scene changes', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 10,
          mode: 'drag',
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(1, false);
        actions.goToScene(2, false);
        actions.goToScene(3, false);
        actions.goToScene(4, false);
      });

      const [state] = result.current;
      expect(state.currentScene).toBe(4);
    });

    it('should handle callbacks being undefined', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(2);
      });

      // Should not throw
      expect(result.current[0].currentScene).toBe(2);
    });
  });
});
