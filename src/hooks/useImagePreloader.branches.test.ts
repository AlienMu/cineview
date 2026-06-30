/**
 * useImagePreloader 分支补充测试
 * 覆盖：
 *  - line 222-223: 一次运行只有 background URL（priorityBatch 为空）时
 *    priorityCompleteFired 立即为 true 并同步 setPriorityComplete(true)
 *  - line 288-289: background Promise.all 解析时该 run 已被 reset 取代
 *    （activeRunIdRef !== runId）→ 提前 return，不提交结果
 *  - line 305-307: run 干净完成时 finally 回调把 currentRunPromiseRef 复位为 null
 *    （等待 startPreload 返回的 promise，确保 finally 微任务先于卸载执行）
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { useImagePreloader } from './useImagePreloader';
import { resetPreloadedImageCache } from './imagePreloadCache';

// Mock Image：成功路径异步 onload（与既有测试一致）。
class MockImage {
  src: string = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() {
    setTimeout(() => {
      if (this.src.includes('error')) {
        this.onerror?.();
      } else if (this.src !== '') {
        this.onload?.();
      }
    }, 10);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).Image = MockImage;

describe('useImagePreloader branch coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPreloadedImageCache();
  });

  it('marks priorityComplete immediately for a background-only run (no priority URLs)', async () => {
    // priorityBatch 为空、background 非空 => initialTotal>0（不走 0-batch 早返回），
    // initialPriorityUrls.size === 0 => priorityCompleteFired=true => line 223 触发。
    const { result } = renderHook(() =>
      useImagePreloader({ backgroundUrls: ['bg-1.jpg', 'bg-2.jpg'] })
    );

    let runPromise: Promise<void> | undefined;
    act(() => {
      const [, actions] = result.current;
      runPromise = actions.startPreload();
    });

    // priorityComplete 应在没有 priority URL 时（运行启动后）变为 true。
    await waitFor(() => {
      expect(result.current[0].priorityComplete).toBe(true);
    });

    await act(async () => {
      await runPromise;
    });

    // 干净完成：两张背景图都成功加载。
    expect(result.current[0].results).toHaveLength(2);
    expect(result.current[0].isLoading).toBe(false);
  });

  it('abandons a background run whose runId was superseded by reset (no result commit)', async () => {
    const { result } = renderHook(() =>
      useImagePreloader({ backgroundUrls: ['bg-a.jpg', 'bg-b.jpg'] })
    );

    act(() => {
      const [, actions] = result.current;
      // 启动后立即 reset：异步 run 此刻停在 background 的 Promise.all await 上，
      // reset() 递增 activeRunIdRef，使 Promise.all 解析后的 runId 校验失败 → line 289 return。
      actions.startPreload();
      actions.reset();
    });

    // reset 把状态清零，被取代的 run 不得提交任何结果。
    await waitFor(() => {
      expect(result.current[0].isLoading).toBe(false);
    });
    // 等待原 background 定时器/abort 全部结算。
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });

    expect(result.current[0].results).toHaveLength(0);
    expect(result.current[0].loadedCount).toBe(0);
  });

  it('clears currentRunPromiseRef when a run finishes cleanly (finally true-branch)', async () => {
    const { result } = renderHook(() =>
      useImagePreloader({ priorityUrls: ['p-1.jpg'], backgroundUrls: ['b-1.jpg'] })
    );

    let runPromise: Promise<void> | undefined;
    act(() => {
      const [, actions] = result.current;
      runPromise = actions.startPreload();
    });

    // 等待 startPreload 的 promise 解析 —— 其 finally 回调随即把
    // currentRunPromiseRef.current === runPromise 复位为 null（line 307）。
    await act(async () => {
      await runPromise;
    });

    expect(result.current[0].isLoading).toBe(false);
    expect(result.current[0].results).toHaveLength(2);

    // 复位生效的可观察证明：可以再次发起一次全新的 run（loadingRef 已释放）。
    let secondRun: Promise<void> | undefined;
    act(() => {
      const [, actions] = result.current;
      secondRun = actions.startPreload();
    });
    await act(async () => {
      await secondRun;
    });
    expect(result.current[0].isLoading).toBe(false);
  });
});
