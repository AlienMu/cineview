/**
 * The arithmetic of a drag transaction: default swipe rules and authored 1.x thresholds.
 */
import type { Report } from '../core/errors';

export interface Threshold {
  /** Displacement ratio needed when released at rest. */
  slow: number;
  /** Displacement ratio needed at `velocity` and above. */
  fast: number;
  /** px/s at which the fast ratio applies. */
  velocity: number;
}

export const DEFAULT_THRESHOLD: Threshold = { slow: 0.3, fast: 0.15, velocity: 1000 };

/** `threshold="0.3 0.15 1000"`: slow ratio, fast ratio, flick velocity (px/s). */
export function parseThreshold(
  text: string | null,
  fallback: Threshold,
  report?: Report
): Threshold {
  if (!text?.trim()) return fallback;
  const values = text.trim().split(/\s+/).map(Number);
  const [a, b, c] = values;
  if (
    values.length > 3 ||
    values.some((n, i) => !Number.isFinite(n) || n <= 0 || (i < 2 && n >= 1))
  ) {
    report?.(
      `threshold="${text}": expected up to three numbers: slow ratio (0–1), fast ratio (0–1), velocity > 0; invalid fields use their defaults`
    );
  }
  const ratio = (n: number | undefined, d: number): number =>
    n !== undefined && Number.isFinite(n) && n > 0 && n < 1 ? n : d;
  const slow = ratio(a, fallback.slow);
  return {
    slow,
    fast: Math.min(ratio(b, Math.min(fallback.fast, slow)), slow),
    velocity: c !== undefined && Number.isFinite(c) && c > 0 ? c : fallback.velocity,
  };
}

/** Required displacement ratio: linear from `slow` at rest to `fast` at `velocity` px/s. */
export function thresholdAt(speed: number, t: Threshold): number {
  if (!Number.isFinite(speed)) return t.slow;
  const k = Math.min(Math.max(speed, 0), t.velocity) / t.velocity;
  return t.slow - k * (t.slow - t.fast);
}

/** A flick against the displacement faster than this cancels, however far the page moved. */
export const REVERSAL_SPEED = 600;

/**
 * Commit or cancel at release. `r` is the signed displacement (+ toward the next scene),
 * `velocity` the signed release velocity in the same sense (px/s). An authored threshold keeps
 * the 1.x speed/distance rule. Otherwise a <=300ms short swipe needs >=8% viewport-height
 * net finger movement; a longer drag needs >=50% page travel. Both ignore movement <=5px.
 * Short re-grabs toward the current scene cancel.
 * pointercancel never commits; fast reversals retain the existing cancellation behavior.
 */
export function shouldCommit(
  r: number,
  velocity: number,
  t: Threshold | null,
  pointerCancel: boolean,
  gesture?: { duration: number; displacement: number; viewport: number }
): boolean {
  if (pointerCancel) return false;
  const travel = Math.abs(r);
  const reversal = travel > 0.001 && r * velocity < 0 && Math.abs(velocity) > REVERSAL_SPEED;
  if (reversal) return false;
  if (t) return travel > thresholdAt(Math.abs(velocity), t);
  if (!gesture || Math.abs(gesture.displacement) <= 5) return false;
  return gesture.duration <= 300
    ? Math.abs(gesture.displacement) >= gesture.viewport * 0.08 && r * gesture.displacement > 0
    : travel >= 0.5;
}

/** Page settle durations (ms): the rest of the slide, a capped snap-back, an edge bounce. */
export const BOUNCE_MAX = 300;
export const EDGE_BOUNCE = 150;
export const slideDuration = (remaining: number, transition: number): number =>
  Math.max(0, Math.abs(remaining)) * transition;
export const cancelDuration = (travel: number, transition: number): number =>
  Math.min(Math.abs(travel) * transition, BOUNCE_MAX);

export type DragUnit = 'time' | 'percent';
export interface DragMapping {
  unit: DragUnit;
  scale: number;
}

/**
 * `unit` / `scale` on the stage, overridden as a group by a scene that sets either (1.x):
 * time: each 1% of a screen advances `scale` ms (default 10); percent: each 1% advances `scale`
 * percent of the scene's element timeline (default 1).
 */
export function parseMapping(
  unit: string | null,
  scale: string | null,
  fallback: DragMapping
): { mapping: DragMapping; invalid: boolean } {
  if (unit === null && scale === null) return { mapping: fallback, invalid: false };
  let invalid = false;
  let u: DragUnit = 'time';
  if (unit === 'time' || unit === 'percent') u = unit;
  else if (unit !== null) invalid = true;
  const fallbackScale = u === 'time' ? 10 : 1;
  const n = scale === null ? fallbackScale : Number(scale);
  if (!Number.isFinite(n) || n < 0) invalid = true;
  return { mapping: { unit: u, scale: Number.isFinite(n) && n >= 0 ? n : fallbackScale }, invalid };
}

/** Element time (ms) reached by dragging `fraction` (0–1) of a screen into a scene of `total` ms. */
export function mapDrag(fraction: number, total: number, m: DragMapping): number {
  const f = Number.isFinite(fraction) ? Math.max(0, fraction) : 0;
  const t = Math.max(0, total);
  const ms = m.unit === 'time' ? f * 100 * m.scale : f * m.scale * t;
  return Math.min(t, ms);
}
