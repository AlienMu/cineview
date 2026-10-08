/**
 * Scene timeline solver.
 *
 * Elements declare duration, delay and an optional `after="name ±offset"`
 * reference to another element in the same scene. Start times are solved once
 * per registration change, never per frame. Exit segments follow the scene's
 * entrance section, as in 1.x zones.
 */

export interface TimeSpec {
  name: string | null;
  duration: number;
  delay: number;
  after: { name: string; offset: number } | null;
  exitDuration: number;
}

export interface Solved {
  start: number;
  end: number;
  exitStart: number;
  exitEnd: number;
}

export interface SceneSolution {
  entranceEnd: number;
  total: number;
  byIndex: Solved[];
  errors: string[];
}

export function parseAfter(text: string | null): TimeSpec['after'] {
  if (!text) return null;
  const m = /^\s*([\w-]+)\s*([+-]\s*\d+(?:\.\d+)?)?\s*$/.exec(text);
  if (!m) return null;
  return { name: m[1]!, offset: m[2] ? Number(m[2].replace(/\s+/g, '')) : 0 };
}

export function solveScene(specs: readonly TimeSpec[]): SceneSolution {
  const errors: string[] = [];
  const byName = new Map<string, number>();
  specs.forEach((s, i) => {
    if (s.name) {
      if (byName.has(s.name)) errors.push(`Duplicate name "${s.name}" in scene`);
      byName.set(s.name, i);
    }
  });

  const start = new Array<number>(specs.length).fill(Number.NaN);
  const visiting = new Set<number>();

  const resolve = (i: number): number => {
    if (!Number.isNaN(start[i]!)) return start[i]!;
    const spec = specs[i]!;
    let base = 0;
    if (spec.after) {
      const dep = byName.get(spec.after.name);
      if (dep === undefined) {
        errors.push(`after="${spec.after.name}" does not match a name in this scene`);
      } else if (visiting.has(dep) || dep === i) {
        errors.push(`Circular after dependency at "${spec.name ?? i}"`);
      } else {
        visiting.add(i);
        const depStart = resolve(dep);
        visiting.delete(i);
        base = depStart + specs[dep]!.duration + spec.after.offset;
      }
    }
    start[i] = Math.max(0, base + spec.delay);
    return start[i]!;
  };

  specs.forEach((_, i) => resolve(i));

  let entranceEnd = 0;
  specs.forEach((s, i) => {
    entranceEnd = Math.max(entranceEnd, start[i]! + s.duration);
  });
  let exitSection = 0;
  for (const s of specs) exitSection = Math.max(exitSection, s.exitDuration);

  const byIndex = specs.map((s, i) => ({
    start: start[i]!,
    end: start[i]! + s.duration,
    exitStart: entranceEnd,
    exitEnd: entranceEnd + s.exitDuration,
  }));
  return { entranceEnd, total: entranceEnd + exitSection, byIndex, errors };
}
