export const CANVAS_ZONE_MS = 3600;
export const CANVAS_PARTICLE_COUNT = 5200;
export const CANVAS_STOPS = [0, 0.2, 0.4, 0.6, 0.8, 1] as const;

export const CANVAS_COPY = {
  zh: [
    ['从内置动画', '到自定义呈现'],
    ['接入组件', '延续你的设计'],
    ['用画布', '绘制独特效果'],
    ['共用动画进度', '同步自定义画面'],
    ['扩展表现', '统一编排'],
  ],
  en: [
    ['Beyond presets', 'Build your own'],
    ['Your components', 'Your design'],
    ['Draw custom', 'canvas effects'],
    ['Share progress', 'Keep visuals in sync'],
    ['Extend the visuals', 'Keep the timing'],
  ],
} as const;

export interface CanvasPoint {
  x: number;
  y: number;
  warm: boolean;
}
interface TextLayout {
  lines: readonly string[];
  x: number;
  y: number;
  fontSize: number;
  lineHeight: number;
  width: number;
}
export interface CanvasTargets {
  width: number;
  height: number;
  particleCount: number;
  particleRadius: number;
  layouts: TextLayout[];
  stages: CanvasPoint[][];
}
export interface CanvasStage {
  from: number;
  to: number;
  progress: number;
}

const clamp = (value: number): number => Math.max(0, Math.min(1, Number.isNaN(value) ? 0 : value));

export function resolveCanvasStage(progress: number): CanvasStage {
  const value = clamp(progress);
  for (let index = 0; index < CANVAS_STOPS.length - 1; index += 1) {
    const start = CANVAS_STOPS[index];
    const end = CANVAS_STOPS[index + 1];
    if (value <= end)
      return { from: index, to: index + 1, progress: clamp((value - start) / (end - start)) };
  }
  return { from: 4, to: 5, progress: 1 };
}

function sampleText(
  mask: CanvasRenderingContext2D,
  layout: TextLayout,
  fontFamily: string
): CanvasPoint[] {
  mask.clearRect(0, 0, mask.canvas.width, mask.canvas.height);
  mask.font = `500 ${layout.fontSize}px ${fontFamily}`;
  mask.textAlign = 'left';
  mask.textBaseline = 'alphabetic';
  mask.fillStyle = '#000';
  layout.lines.forEach((line, index) =>
    mask.fillText(line, layout.x, layout.y + index * layout.lineHeight)
  );
  const image = mask.getImageData(0, 0, mask.canvas.width, mask.canvas.height);
  const points: CanvasPoint[] = [];
  for (let y = 0; y < image.height; y += 3) {
    for (let x = 0; x < image.width; x += 3) {
      if (image.data[(y * image.width + x) * 4 + 3] >= 128) points.push({ x, y, warm: false });
    }
  }
  return points;
}

export function buildCanvasTargets(
  mask: CanvasRenderingContext2D,
  width: number,
  height: number,
  fontFamily: string,
  lang: 'zh' | 'en'
): CanvasTargets {
  mask.canvas.width = Math.max(1, Math.ceil(width));
  mask.canvas.height = Math.max(1, Math.ceil(height));
  const fontSize = width < 600 ? (lang === 'zh' ? 60 : 46) : width < 1000 ? 86 : 144;
  const padding = width < 600 ? 32 : 104;
  const layouts = CANVAS_COPY[lang].map((lines) => {
    mask.font = `500 ${fontSize}px ${fontFamily}`;
    const measuredWidth = Math.max(...lines.map((line) => mask.measureText(line).width), 1);
    const fit = Math.min(
      1,
      Math.max(1, width - padding * 2) / measuredWidth,
      (height * 0.4) / (fontSize * 2.12)
    );
    const fittedFont = fontSize * fit;
    return {
      lines,
      x: (width - measuredWidth * fit) / 2,
      y: height * 0.48 - fittedFont * 0.16,
      fontSize: fittedFont,
      lineHeight: fittedFont * 1.12,
      width: measuredWidth * fit,
    };
  });
  const samples = layouts.map((layout) => sampleText(mask, layout, fontFamily));
  const particleCount = Math.min(CANVAS_PARTICLE_COUNT, ...samples.map((points) => points.length));
  const stages = samples.map((points) =>
    Array.from({ length: particleCount }, (_, index) => ({
      ...points[Math.floor((index * points.length) / particleCount)],
      // Particle identity owns its color, so both colors remain mixed inside every glyph.
      warm: index % 5 < 2,
    }))
  );
  // A terminal hold shares the last target; progress 1 never starts another transition.
  layouts.push(layouts[layouts.length - 1]);
  stages.push(stages[stages.length - 1]);
  return {
    width,
    height,
    particleCount,
    particleRadius: width < 600 ? 0.95 : 1.25,
    layouts,
    stages,
  };
}

export function drawCanvasTargets(
  context: CanvasRenderingContext2D,
  targets: CanvasTargets,
  progress: number,
  options: { dpr: number; ink: string; accent: string; line?: string }
): void {
  const { width, height, stages, layouts, particleCount, particleRadius } = targets;
  const stage = resolveCanvasStage(progress);
  const travel = clamp((stage.progress - 0.64) / 0.36);
  const amount = travel * travel * (3 - 2 * travel);
  const source = layouts[stage.from];
  const target = layouts[stage.to];
  context.setTransform(options.dpr, 0, 0, options.dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  for (const warm of [false, true]) {
    context.globalAlpha = warm ? 0.94 : 0.88;
    context.fillStyle = warm ? options.accent : options.ink;
    context.beginPath();
    for (let index = 0; index < particleCount; index += 1) {
      const from = stages[stage.from][index];
      const to = stages[stage.to][index];
      if (from.warm !== warm) continue;
      const x = from.x + (to.x - from.x) * amount;
      const y = from.y + (to.y - from.y) * amount;
      context.moveTo(x + particleRadius, y);
      context.arc(x, y, particleRadius, 0, Math.PI * 2);
    }
    context.fill();
  }

  const lerp = (a: number, b: number): number => a + (b - a) * amount;
  const x = lerp(source.x, target.x);
  const y = lerp(source.y, target.y);
  const span = lerp(source.width, target.width);
  const font = lerp(source.fontSize, target.fontSize);
  const bottom = y + lerp(source.lineHeight, target.lineHeight) + font * 0.3;
  const bracket = width < 600 ? 12 : 22;
  context.globalAlpha = 0.7;
  context.strokeStyle = options.line ?? options.accent;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(x - bracket, y - font * 0.85 + bracket);
  context.lineTo(x - bracket, y - font * 0.85);
  context.lineTo(x + bracket, y - font * 0.85);
  context.moveTo(x, bottom);
  context.lineTo(x + span, bottom);
  context.lineTo(x + span, bottom - bracket);
  context.stroke();

  const trackWidth = Math.min(240, width - 64);
  const trackX = (width - trackWidth) / 2;
  const trackY = Math.min(height - 56, bottom + (width < 600 ? 72 : 104));
  for (let index = 0; index < 5; index += 1) {
    const active = clamp(progress) >= index * 0.2;
    context.globalAlpha = active ? 0.9 : 0.22;
    context.fillStyle = options.accent;
    context.fillRect(trackX + (index * trackWidth) / 5, trackY, trackWidth / 5 - 8, active ? 2 : 1);
  }
  context.globalAlpha = 1;
}
