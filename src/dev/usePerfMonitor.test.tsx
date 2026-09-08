import { StrictMode } from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { PerformanceMetrics } from '../types';
import { PerfPanel } from './PerfPanel';
import { usePerfMonitor, type PerformanceSource } from './usePerfMonitor';

function createSource(): PerformanceSource & {
  getPerformanceMetrics: jest.Mock<PerformanceMetrics, []>;
} {
  return {
    getPerformanceMetrics: jest.fn(() => ({
      fps: 60,
      avgFrameTime: 16.67,
      bundleSize: 128.5,
    })),
  };
}

describe('shared performance snapshots', () => {
  beforeEach(() => jest.useFakeTimers());

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shares one poll and snapshot between consumers of the same runtime getter', () => {
    const source = createSource();
    const first = renderHook(() => usePerfMonitor(source));
    const second = renderHook(() => usePerfMonitor({ ...source }));

    expect(source.getPerformanceMetrics).toHaveBeenCalledTimes(1);
    expect(first.result.current).toBe(second.result.current);

    act(() => jest.advanceTimersByTime(499));
    expect(source.getPerformanceMetrics).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(1));
    expect(source.getPerformanceMetrics).toHaveBeenCalledTimes(2);
    expect(first.result.current?.history).toHaveLength(2);
    expect(first.result.current).toBe(second.result.current);

    first.unmount();
    act(() => jest.advanceTimersByTime(500));
    expect(source.getPerformanceMetrics).toHaveBeenCalledTimes(3);
    second.unmount();
    act(() => jest.advanceTimersByTime(1000));
    expect(source.getPerformanceMetrics).toHaveBeenCalledTimes(3);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('stops polling when disabled and resumes with a current sample', () => {
    const source = createSource();
    const hook = renderHook(({ enabled }) => usePerfMonitor(source, enabled), {
      initialProps: { enabled: false },
    });

    expect(hook.result.current).toBeNull();
    expect(source.getPerformanceMetrics).not.toHaveBeenCalled();

    hook.rerender({ enabled: true });
    expect(source.getPerformanceMetrics).toHaveBeenCalledTimes(1);
    hook.rerender({ enabled: false });
    act(() => jest.advanceTimersByTime(2000));
    expect(source.getPerformanceMetrics).toHaveBeenCalledTimes(1);
    expect(hook.result.current).toBeNull();
    expect(jest.getTimerCount()).toBe(0);

    source.getPerformanceMetrics.mockReturnValue({ fps: 40, avgFrameTime: 25, bundleSize: 128.5 });
    hook.rerender({ enabled: true });
    expect(hook.result.current?.current.fps).toBe(40);
    expect(source.getPerformanceMetrics).toHaveBeenCalledTimes(2);
    hook.unmount();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('releases the old source when the runtime ref changes or disappears', () => {
    const original = createSource();
    const replacement = createSource();
    const hook = renderHook(({ source }) => usePerfMonitor(source), {
      initialProps: { source: original as PerformanceSource | null },
    });

    hook.rerender({ source: replacement });
    act(() => jest.advanceTimersByTime(500));
    expect(original.getPerformanceMetrics).toHaveBeenCalledTimes(1);
    expect(replacement.getPerformanceMetrics).toHaveBeenCalledTimes(2);
    hook.rerender({ source: null });
    act(() => jest.advanceTimersByTime(500));
    expect(replacement.getPerformanceMetrics).toHaveBeenCalledTimes(2);
    expect(hook.result.current).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('keeps bounded history and one active poll after StrictMode remounts effects', () => {
    const source = createSource();
    const hook = renderHook(() => usePerfMonitor(source), { wrapper: StrictMode });
    const initialReads = source.getPerformanceMetrics.mock.calls.length;

    act(() => jest.advanceTimersByTime(30_000));
    expect(source.getPerformanceMetrics).toHaveBeenCalledTimes(initialReads + 60);
    expect(hook.result.current?.history).toHaveLength(60);
    hook.unmount();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('labels resource timing bytes as a loaded-code estimate and keeps unavailable memory explicit', () => {
    render(<PerfPanel source={createSource()} />);

    expect(screen.getByText('Loaded code')).toHaveAttribute(
      'title',
      'Estimated loaded page JavaScript and CSS from Resource Timing; not package gzip size.'
    );
    expect(screen.getByText('~128.5 KB')).toBeInTheDocument();
    expect(screen.getByText('Avg Frame')).toBeInTheDocument();
    expect(screen.getByText('n/a')).toBeInTheDocument();
  });

  it('keeps collapsed controls operable before and after a runtime ref becomes ready', () => {
    const panel = render(<PerfPanel defaultExpanded={false} />);
    expect(
      screen.getByRole('button', { name: 'Expand CineView performance panel' })
    ).toHaveTextContent('--');

    fireEvent.click(screen.getByRole('button', { name: 'Expand CineView performance panel' }));
    expect(screen.getByText('Waiting for CineView ref')).toBeInTheDocument();
    panel.rerender(<PerfPanel source={createSource()} position="bottom-left" />);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse CineView performance panel' }));
    expect(
      screen.getByRole('button', { name: 'Expand CineView performance panel' })
    ).toHaveTextContent('60');
  });

  it.each([
    { fps: 60, frameTime: 16.67, warning: null },
    { fps: 50, frameTime: 25, warning: null },
    { fps: 25, frameTime: 40, warning: 'Performance warning' },
    { fps: 10, frameTime: 100, warning: 'Performance issue' },
  ])(
    'shows frame-time warnings from measured values ($frameTime ms)',
    ({ fps, frameTime, warning }) => {
      const source = createSource();
      source.getPerformanceMetrics.mockReturnValue({
        fps,
        avgFrameTime: frameTime,
        memoryUsage: 24.5,
        bundleSize: 128.5,
      });
      render(<PerfPanel source={source} />);
      expect(screen.getByText('24.5 MB')).toBeInTheDocument();
      if (warning) {
        expect(screen.getByText(warning)).toBeInTheDocument();
      } else {
        expect(screen.queryByText(/^Performance (warning|issue)$/)).not.toBeInTheDocument();
      }
    }
  );
});
