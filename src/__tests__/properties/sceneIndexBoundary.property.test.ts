/**
 * Property-Based Test: Scene Index Boundary Safety
 * **Validates: Requirements 2.7**
 *
 * Property 2: For any scene transition operation, the current scene index must always remain within valid bounds
 * Formal: ∀ operation op, currentIndex i, totalScenes n: 0 ≤ i < n
 */

import { test } from '@fast-check/jest';
import * as fc from 'fast-check';
import { act } from 'react';
import { renderHook } from '@testing-library/react';
import { useSceneManager } from '../../hooks/useSceneManager';

describe('Property: Scene Index Boundary Safety', () => {
  test.prop([
    fc.integer({ min: 1, max: 20 }), // totalScenes
    fc.array(fc.oneof(fc.constant('next'), fc.constant('prev'), fc.integer({ min: 0, max: 19 })), {
      minLength: 1,
      maxLength: 50,
    }), // operations
  ])(
    'For any sequence of scene transition operations, scene index must always remain within valid bounds',
    (totalScenes: number, operations: Array<'next' | 'prev' | number>) => {
      const ts = totalScenes;
      const ops = operations;
      const { result } = renderHook(() => useSceneManager({ totalScenes: ts, mode: 'drag' }));

      // Initial state verification
      const [state] = result.current;
      expect(state.currentScene).toBeGreaterThanOrEqual(0);
      expect(state.currentScene).toBeLessThan(ts);

      // Execute operation sequence
      ops.forEach((operation) => {
        act(() => {
          const [, actions] = result.current;
          if (operation === 'next') {
            actions.nextScene();
          } else if (operation === 'prev') {
            actions.prevScene();
          } else if (typeof operation === 'number') {
            // Ensure operation index is within valid range
            const targetIndex = Math.min(Math.max(0, operation), ts - 1);
            actions.goToScene(targetIndex);
          }
        });

        // Verify index remains within valid range after each operation
        const [currentState] = result.current;
        expect(currentState.currentScene).toBeGreaterThanOrEqual(0);
        expect(currentState.currentScene).toBeLessThan(ts);
      });
    }
  );

  test.prop([fc.integer({ min: 1, max: 20 }), fc.integer({ min: -100, max: 100 })])(
    'Boundary case: attempting to jump to invalid index should stay within valid range or remain unchanged',
    (totalScenes: number, targetIndex: number) => {
      const ts = totalScenes;
      const ti = targetIndex;
      const { result } = renderHook(() => useSceneManager({ totalScenes: ts, mode: 'drag' }));

      const [initialState] = result.current;
      const initialScene = initialState.currentScene;

      // Suppress console.warn to avoid test output noise
      const originalWarn = console.warn;
      console.warn = (): void => {
        // Silent
      };

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(ti);
      });

      // Restore console.warn
      console.warn = originalWarn;

      // Verify index is constrained within valid range or remains unchanged
      const [finalState] = result.current;
      expect(finalState.currentScene).toBeGreaterThanOrEqual(0);
      expect(finalState.currentScene).toBeLessThan(ts);

      // If target index is valid, should jump to target index
      if (ti >= 0 && ti < ts) {
        expect(finalState.currentScene).toBe(ti);
      } else {
        // If target index is invalid, should remain at original position
        expect(finalState.currentScene).toBe(initialScene);
      }
    }
  );

  test.prop([fc.integer({ min: 2, max: 20 })])(
    'Boundary case: when navigating backward at first scene, index should remain 0',
    (totalScenes: number) => {
      const ts = totalScenes;
      const { result } = renderHook(() => useSceneManager({ totalScenes: ts, mode: 'drag' }));

      // Ensure at first scene
      act(() => {
        const [, actions] = result.current;
        actions.goToScene(0);
      });

      const [state1] = result.current;
      expect(state1.currentScene).toBe(0);

      // Attempt to navigate backward
      act(() => {
        const [, actions] = result.current;
        actions.prevScene();
      });

      // Should still be at first scene
      const [state2] = result.current;
      expect(state2.currentScene).toBe(0);
    }
  );

  test.prop([fc.integer({ min: 2, max: 20 })])(
    'Boundary case: when navigating forward at last scene, index should remain totalScenes - 1',
    (totalScenes: number) => {
      const ts = totalScenes;
      const { result } = renderHook(() => useSceneManager({ totalScenes: ts, mode: 'drag' }));

      // Jump to last scene
      act(() => {
        const [, actions] = result.current;
        actions.goToScene(ts - 1);
      });

      const [state1] = result.current;
      expect(state1.currentScene).toBe(ts - 1);

      // Attempt to navigate forward
      act(() => {
        const [, actions] = result.current;
        actions.nextScene();
      });

      // Should still be at last scene
      const [state2] = result.current;
      expect(state2.currentScene).toBe(ts - 1);
    }
  );
});
