import {
  buildCanvasTargets,
  CANVAS_COPY,
  CANVAS_PARTICLE_COUNT,
  CANVAS_STOPS,
  CANVAS_ZONE_MS,
  drawCanvasTargets,
  resolveCanvasStage,
  type CanvasTargets,
} from '../../../site/src/components/canvasExtensibility';

describe('homepage Canvas extensibility timeline', () => {
  it('holds every readable phrase and moves continuously in either scroll direction', () => {
    const layouts = Array.from({ length: 6 }, () => ({
      lines: ['Test'],
      x: 50,
      y: 100,
      fontSize: 20,
      lineHeight: 24,
      width: 100,
    }));
    const targets: CanvasTargets = {
      width: 400,
      height: 300,
      particleCount: 1,
      particleRadius: 1,
      layouts,
      stages: [0, 100, 200, 300, 400, 400].map((x) => [{ x, y: 100, warm: false }]),
    };
    const context = {
      setTransform: jest.fn(),
      clearRect: jest.fn(),
      fillRect: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
    } as unknown as CanvasRenderingContext2D;
    const position = (progress: number): number => {
      (context.arc as jest.Mock).mockClear();
      drawCanvasTargets(context, targets, progress, { dpr: 1, ink: '#000', accent: '#fff' });
      return (context.arc as jest.Mock).mock.calls[0][0];
    };

    expect(position(0)).toBe(position(0.04));
    for (const stop of [0.2, 0.4, 0.6, 0.8]) {
      expect(position(stop - 0.03)).toBe(position(stop + 0.03));
    }
    const forward = [0.06, 0.08, 0.1, 0.12, 0.14].map(position);
    expect(forward.every((x, i) => i === 0 || x > forward[i - 1])).toBe(true);
    expect([0.14, 0.12, 0.1, 0.08, 0.06].map(position)).toEqual([...forward].reverse());
    expect(position(0.85)).toBe(position(1));
  });

  it('keeps the authored zone budget and state stops stable', () => {
    expect(CANVAS_ZONE_MS).toBe(3600);
    expect(CANVAS_PARTICLE_COUNT).toBeLessThanOrEqual(5200);
    expect(CANVAS_STOPS).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });

  it('clamps progress and resolves the same state boundaries in reverse', () => {
    expect(resolveCanvasStage(-1)).toEqual({ from: 0, to: 1, progress: 0 });
    expect(resolveCanvasStage(0.2)).toEqual({ from: 0, to: 1, progress: 1 });
    expect(resolveCanvasStage(0.6)).toEqual({ from: 2, to: 3, progress: 1 });
    expect(resolveCanvasStage(0.8)).toEqual({ from: 3, to: 4, progress: 1 });
    expect(resolveCanvasStage(2)).toEqual({ from: 4, to: 5, progress: 1 });
  });

  it('keeps a target for every stop and draws the final state without an index gap', () => {
    const mask = {
      canvas: { width: 0, height: 0 },
      clearRect: jest.fn(),
      measureText: jest.fn(() => ({ width: 120 })),
      fillText: jest.fn(),
      getImageData: jest.fn(() => ({
        width: 40,
        height: 20,
        data: new Uint8ClampedArray(40 * 20 * 4).fill(255),
      })),
    } as unknown as CanvasRenderingContext2D;
    const targets = buildCanvasTargets(mask, 40, 20, 'Georgia, serif', 'en');
    expect(targets.stages).toHaveLength(CANVAS_STOPS.length);

    const context = {
      setTransform: jest.fn(),
      clearRect: jest.fn(),
      fillRect: jest.fn(),
      fillText: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
    } as unknown as CanvasRenderingContext2D;
    expect(() =>
      drawCanvasTargets(context, targets, 1, { dpr: 1, ink: '#1a1814', accent: '#9e6344' })
    ).not.toThrow();
    expect(context.fillRect).toHaveBeenCalled();
    expect(mask.fillText).toHaveBeenCalledWith(
      CANVAS_COPY.en[4][0],
      expect.any(Number),
      expect.any(Number)
    );
    expect(context.fillText).not.toHaveBeenCalled();
    expect(context.arc).toHaveBeenCalledTimes(targets.particleCount);
    const fills: string[] = [];
    (context.fill as jest.Mock).mockImplementation(() => fills.push(String(context.fillStyle)));
    drawCanvasTargets(context, targets, 0.1, { dpr: 1, ink: '#352820', accent: '#994f36' });
    expect(fills).toEqual(['#352820', '#994f36']);
    expect(targets.particleCount).toBeGreaterThan(0);
    expect(targets.particleCount).toBeLessThanOrEqual(CANVAS_PARTICLE_COUNT);
    expect(targets.stages[0].some((point) => point.warm)).toBe(true);
    expect(targets.stages[0].some((point) => !point.warm)).toBe(true);
    expect(targets.stages[4]).toBe(targets.stages[5]);

    for (const progress of [0, 0.1, 0.17, 0.2, 0.5, 0.75, 0.8, 0.99, 1, 0.5, 0]) {
      (context.arc as jest.Mock).mockClear();
      drawCanvasTargets(context, targets, progress, { dpr: 1, ink: '#352820', accent: '#994f36' });
      expect(context.arc).toHaveBeenCalledTimes(targets.particleCount);
      expect(context.fillText).not.toHaveBeenCalled();
    }
    (context.arc as jest.Mock).mockClear();
    drawCanvasTargets(context, targets, 0.8, { dpr: 1, ink: '#352820', accent: '#994f36' });
    const finalPoints = (context.arc as jest.Mock).mock.calls.slice();
    (context.arc as jest.Mock).mockClear();
    drawCanvasTargets(context, targets, 1, { dpr: 1, ink: '#352820', accent: '#994f36' });
    expect((context.arc as jest.Mock).mock.calls).toEqual(finalPoints);
  });
});
