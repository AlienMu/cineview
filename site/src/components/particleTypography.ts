export const PARTICLE_DURATION_MS = 9000;
const WORD = 'CINEVIEW';

interface Particle {
  x: number;
  y: number;
  fromX: number;
  fromY: number;
  delay: number;
  warm: boolean;
}

export interface ParticleTypography {
  width: number;
  height: number;
  points: Particle[];
  size: number;
  font: string;
  baseline: number;
}

const unit = (value: number): number => Math.max(0, Math.min(1, Number.isNaN(value) ? 0 : value));
const fraction = (value: number): number => value - Math.floor(value);

/** Keep only rasterized glyph ink; spaces and letter counters stay empty. */
export function sampleGlyphMask(image: ImageData, step: number): Particle[] {
  const points: Particle[] = [];
  const stride = Math.max(1, step);
  for (let y = 0; y < image.height; y += stride) {
    for (let x = 0; x < image.width; x += stride) {
      if (image.data[(Math.floor(y) * image.width + Math.floor(x)) * 4 + 3] < 128) continue;
      const index = points.length + 1;
      const a = fraction(index * 0.61803398875);
      const b = fraction(index * 0.75487766625);
      points.push({
        x,
        y,
        fromX: (0.04 + a * 0.92) * image.width,
        fromY: (0.12 + b * 0.76) * image.height,
        delay: a * 0.17,
        warm: index % 7 === 0,
      });
    }
  }
  return points;
}

export function buildTypography(
  mask: CanvasRenderingContext2D,
  width: number,
  height: number,
  fontFamily: string
): ParticleTypography {
  mask.canvas.width = Math.max(1, Math.ceil(width));
  mask.canvas.height = Math.max(1, Math.ceil(height));
  mask.font = `600 100px ${fontFamily}`;
  const fontSize = Math.min((width * 0.9 * 100) / mask.measureText(WORD).width, height * 0.5, 184);
  const font = `600 ${fontSize}px ${fontFamily}`;
  mask.font = font;
  mask.textAlign = 'center';
  const metrics = mask.measureText(WORD);
  const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.72;
  const descent = metrics.actualBoundingBoxDescent || 0;
  const baseline = height * 0.5 + (ascent - descent) * 0.5;
  mask.fillText(WORD, width * 0.5, baseline);
  const step = Math.max(1.4, Math.min(3.5, fontSize / 42));
  return {
    width,
    height,
    font,
    baseline,
    size: Math.max(1, step * 0.76),
    points: sampleGlyphMask(mask.getImageData(0, 0, mask.canvas.width, mask.canvas.height), step),
  };
}

/** A frame depends only on its arguments; reverse scrolling retraces every point. */
export function drawTypography(
  context: CanvasRenderingContext2D,
  typography: ParticleTypography,
  progress: number,
  options: { dpr: number; ink: string; accent: string; reduced: boolean }
): void {
  const { width, height, points, size } = typography;
  context.setTransform(options.dpr, 0, 0, options.dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = options.ink;
  context.globalAlpha = 1;
  if (options.reduced) {
    context.font = typography.font;
    context.textAlign = 'center';
    context.fillText(WORD, width * 0.5, typography.baseline);
    return;
  }
  const p = unit(progress);
  for (const point of points) {
    const t = unit((p - point.delay) / 0.78);
    const ease = t * t * (3 - 2 * t);
    const x = point.fromX + (point.x - point.fromX) * ease;
    const y = point.fromY + (point.y - point.fromY) * ease;
    context.globalAlpha = 0.35 + ease * 0.65;
    context.fillStyle = point.warm ? options.accent : options.ink;
    context.fillRect(x - size * 0.5, y - size * 0.5, size, size);
  }
  context.globalAlpha = 1;
}
