/**
 * Scene `covered` (plan v3 §3.2; lexicon #11): how a stacked scene looks while the next scene
 * covers it. The progress is the next scene's entry into the viewport (CSS `entry 0%` to
 * `entry 100%`): 0 while it is below the screen, 1 once it fills it. A veil darkens the scene on
 * that progress; `recede` also scales it back. Both are compositor properties.
 */
import type { Report } from '../core/errors';
import type { ViewRange } from '../core/view';

export interface CoverLook {
  /** Veil opacity at full cover (the veil is black). */
  veil: number;
  /** Scene scale at full cover. */
  scale: number;
}

const LOOKS: Readonly<Record<string, CoverLook>> = {
  dim: { veil: 0.5, scale: 1 },
  recede: { veil: 0.3, scale: 0.92 },
};

/** The next scene's entry range: the covering progress. */
export const COVER_RANGE: ViewRange = [
  { name: 'entry', offset: 0 },
  { name: 'entry', offset: 1 },
];

/** `covered` on a scene; null when absent or unreadable. Reduced motion keeps the veil only. */
export function parseCovered(
  value: string | null,
  reducedMotion: boolean,
  report: Report
): CoverLook | null {
  if (value === null) return null;
  const look = LOOKS[value.trim()];
  if (!look) {
    report(`covered="${value}": expected dim or recede`);
    return null;
  }
  return reducedMotion ? { ...look, scale: 1 } : look;
}

/** The scene's look at covering progress p (direct writes: fallback, drag, held next scene). */
export function writeCover(host: HTMLElement, veil: HTMLElement, look: CoverLook, p: number): void {
  veil.style.opacity = String(look.veil * p);
  host.style.scale = look.scale === 1 || p === 0 ? '' : String(1 - (1 - look.scale) * p);
}

export function clearCover(host: HTMLElement, veil: HTMLElement): void {
  veil.style.opacity = '';
  host.style.scale = '';
}

/** Keyframes for the native path: the veil, and the scene when it scales. */
export function coverKeyframes(look: CoverLook): { veil: Keyframe[]; host: Keyframe[] | null } {
  return {
    veil: [{ opacity: 0 }, { opacity: look.veil }],
    host: look.scale === 1 ? null : [{ scale: '1' }, { scale: String(look.scale) }],
  };
}
