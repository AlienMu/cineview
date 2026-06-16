/**
 * Property-Based Test: 场景索引边界安全
 * **Validates: Requirements 2.7**
 *
 * 属性 2: 对于任意场景切换操作，当前场景索引必须始终在有效范围内
 * 形式化：∀ operation op, currentIndex i, totalScenes n: 0 ≤ i < n
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { test } from '@fast-check/jest';
import * as fc from 'fast-check';
import { act } from 'react';
import { renderHook } from '@testing-library/react';
import { useSceneManager } from '../../hooks/useSceneManager';

describe('Property: 场景索引边界安全', () => {
  test.prop([
    fc.integer({ min: 1, max: 20 }), // totalScenes
    fc.array(fc.oneof(fc.constant('next'), fc.constant('prev'), fc.integer({ min: 0, max: 19 })), {
      minLength: 1,
      maxLength: 50,
    }), // operations
  ])(
    '对于任意场景切换操作序列，场景索引必须始终在有效范围内',
    (totalScenes: number, operations: Array<'next' | 'prev' | number>) => {
      const ts = totalScenes;
      const ops = operations;
      const { result } = renderHook(() => useSceneManager({ totalScenes: ts, mode: 'drag' }));

      // 初始状态验证
      const [state] = result.current;
      expect(state.currentScene).toBeGreaterThanOrEqual(0);
      expect(state.currentScene).toBeLessThan(ts);

      // 执行操作序列
      ops.forEach((operation) => {
        act(() => {
          const [, actions] = result.current;
          if (operation === 'next') {
            actions.nextScene();
          } else if (operation === 'prev') {
            actions.prevScene();
          } else if (typeof operation === 'number') {
            // 确保操作的索引在有效范围内
            const targetIndex = Math.min(Math.max(0, operation), ts - 1);
            actions.goToScene(targetIndex);
          }
        });

        // 每次操作后验证索引仍在有效范围内
        const [currentState] = result.current;
        expect(currentState.currentScene).toBeGreaterThanOrEqual(0);
        expect(currentState.currentScene).toBeLessThan(ts);
      });
    }
  );

  test.prop([fc.integer({ min: 1, max: 20 }), fc.integer({ min: -100, max: 100 })])(
    '边界情况：尝试跳转到无效索引时，应保持在有效范围内或不变',
    (totalScenes: number, targetIndex: number) => {
      const ts = totalScenes;
      const ti = targetIndex;
      const { result } = renderHook(() => useSceneManager({ totalScenes: ts, mode: 'drag' }));

      const [initialState] = result.current;
      const initialScene = initialState.currentScene;

      // 抑制 console.warn 以避免测试输出噪音
      const originalWarn = console.warn;
      console.warn = (): void => {
        // 静默
      };

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(ti);
      });

      // 恢复 console.warn
      console.warn = originalWarn;

      // 验证索引被限制在有效范围内或保持不变
      const [finalState] = result.current;
      expect(finalState.currentScene).toBeGreaterThanOrEqual(0);
      expect(finalState.currentScene).toBeLessThan(ts);

      // 如果目标索引有效，应该跳转到目标索引
      if (ti >= 0 && ti < ts) {
        expect(finalState.currentScene).toBe(ti);
      } else {
        // 如果目标索引无效，应该保持原位置
        expect(finalState.currentScene).toBe(initialScene);
      }
    }
  );

  test.prop([fc.integer({ min: 2, max: 20 })])(
    '边界情况：在第一个场景时向前切换，索引应保持为 0',
    (totalScenes: number) => {
      const ts = totalScenes;
      const { result } = renderHook(() => useSceneManager({ totalScenes: ts, mode: 'drag' }));

      // 确保在第一个场景
      act(() => {
        const [, actions] = result.current;
        actions.goToScene(0);
      });

      const [state1] = result.current;
      expect(state1.currentScene).toBe(0);

      // 尝试向前切换
      act(() => {
        const [, actions] = result.current;
        actions.prevScene();
      });

      // 应该仍然在第一个场景
      const [state2] = result.current;
      expect(state2.currentScene).toBe(0);
    }
  );

  test.prop([fc.integer({ min: 2, max: 20 })])(
    '边界情况：在最后一个场景时向后切换，索引应保持为 totalScenes - 1',
    (totalScenes: number) => {
      const ts = totalScenes;
      const { result } = renderHook(() => useSceneManager({ totalScenes: ts, mode: 'drag' }));

      // 跳转到最后一个场景
      act(() => {
        const [, actions] = result.current;
        actions.goToScene(ts - 1);
      });

      const [state1] = result.current;
      expect(state1.currentScene).toBe(ts - 1);

      // 尝试向后切换
      act(() => {
        const [, actions] = result.current;
        actions.nextScene();
      });

      // 应该仍然在最后一个场景
      const [state2] = result.current;
      expect(state2.currentScene).toBe(ts - 1);
    }
  );
});
