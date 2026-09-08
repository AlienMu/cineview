import {
  drawTypography,
  sampleGlyphMask,
  type ParticleTypography,
} from '../../../site/src/components/particleTypography';

function glyphMask(rows: string[]): ImageData {
  const width = rows[0].length;
  const data = new Uint8ClampedArray(width * rows.length * 4);
  rows.forEach((row, y) => {
    [...row].forEach((pixel, x) => {
      data[(y * width + x) * 4 + 3] = pixel === '#' ? 255 : 0;
    });
  });
  return { width, height: rows.length, data, colorSpace: 'srgb' } as ImageData;
}

function makeContext(): CanvasRenderingContext2D {
  return {
    setTransform: jest.fn(),
    clearRect: jest.fn(),
    fillRect: jest.fn(),
    fillText: jest.fn(),
  } as unknown as CanvasRenderingContext2D;
}

const options = { dpr: 2, ink: '#1a1814', accent: '#ad8138', reduced: false };

describe('homepage particle typography', () => {
  const mask = glyphMask(['###..###', '#....#.#', '###..###']);
  const typography: ParticleTypography = {
    width: mask.width,
    height: mask.height,
    points: sampleGlyphMask(mask, 1),
    size: 1,
    font: '600 100px Georgia, serif',
    baseline: 2,
  };

  it('uses only opaque glyph pixels, keeping counters and letter gaps empty', () => {
    const coordinates = typography.points.map(({ x, y }) => [x, y]);
    expect(coordinates).toHaveLength(15);
    expect(coordinates).toContainEqual([0, 1]);
    expect(coordinates).not.toContainEqual([1, 1]);
    expect(coordinates).not.toContainEqual([3, 0]);
    expect(coordinates).not.toContainEqual([6, 1]);
    expect(sampleGlyphMask(mask, 1)).toEqual(typography.points);
  });

  it('retraces the identical frame after arbitrary forward and reverse progress', () => {
    const context = makeContext();
    const frame = (progress: number): unknown[] => {
      (context.fillRect as jest.Mock).mockClear();
      drawTypography(context, typography, progress, options);
      return (context.fillRect as jest.Mock).mock.calls.map((args) => [...args]);
    };
    const original = frame(0.41);
    expect(frame(0.88)).not.toEqual(original);
    frame(0.02);
    expect(frame(0.41)).toEqual(original);
    expect(frame(1)).toEqual(typography.points.map(({ x, y }) => [x - 0.5, y - 0.5, 1, 1]));
    expect(frame(12)).toEqual(frame(1));
    expect(frame(-1)).toEqual(frame(0));
    expect(context.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
  });

  it('draws a readable stationary word for reduced motion at any timeline position', () => {
    const context = makeContext();
    for (const progress of [0, 0.25, 1, 0.12]) {
      drawTypography(context, typography, progress, { ...options, reduced: true });
    }
    expect(context.fillRect).not.toHaveBeenCalled();
    expect(context.fillText).toHaveBeenCalledTimes(4);
    expect((context.fillText as jest.Mock).mock.calls).toEqual(
      Array.from({ length: 4 }, () => ['CINEVIEW', mask.width / 2, typography.baseline])
    );
  });
});
