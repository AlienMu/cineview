/** @jest-environment node */
import { renderToString } from 'react-dom/server';
import { PerfPanel, usePerfMonitor, type PerformanceSource } from './index';

describe('development tools without a DOM', () => {
  it('imports and renders without accessing the source or starting display polling', () => {
    expect(typeof document).toBe('undefined');
    expect(typeof window).toBe('undefined');
    const source: PerformanceSource = {
      getPerformanceMetrics: jest.fn(() => {
        throw new Error('Browser performance must not be read during SSR');
      }),
    };
    const interval = jest.spyOn(globalThis, 'setInterval');

    function Snapshot(): import('react').JSX.Element {
      const snapshot = usePerfMonitor(source);
      return <span>{snapshot === null ? 'pending' : 'sampled'}</span>;
    }

    try {
      expect(renderToString(<Snapshot />)).toContain('pending');
      expect(renderToString(<PerfPanel source={source} />)).toContain('Waiting for CineView ref');
      expect(source.getPerformanceMetrics).not.toHaveBeenCalled();
      expect(interval).not.toHaveBeenCalled();
    } finally {
      interval.mockRestore();
    }
  });
});
