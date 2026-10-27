/**
 * Scene `covered` (plan v3 §3.2; lexicon #11): how a stacked scene looks while the next scene
 * covers it. The progress is the next scene's entry into the viewport (CSS `entry 0%` to
 * `entry 100%`): 0 while it is below the screen, 1 once it fills it. A veil darkens the scene on
 * that progress; `recede` also scales it back. Both are compositor properties. <cv-stack> cards
 * take the same looks on the next card's arrival (render/deck.ts).
 */
import type { Report } from '../core/errors';
import type { ViewRange } from '../core/view';

export interface CoverLook {
  /** Veil opacity at full cover (black by default; 1 when the page sets `--cv-veil`). */
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

/**
 * A page colour for the veil (`--cv-veil` on the scene or above it, read when the stage builds):
 * its own alpha is the strength at full cover, so the veil's opacity is the covering progress
 * alone. Without one the veil stays black at the look's strength.
 */
export function withVeilColour(look: CoverLook, colour: string): CoverLook {
  return colour.trim() ? { ...look, veil: 1 } : look;
}

/** The scene's look at covering progress p (direct writes: fallback, drag, held next scene). */
export function writeCover(host: HTMLElement, veil: HTMLElement, look: CoverLook, p: number): void {
  veil.style.opacity = String(look.veil * p);
  host.style.scale = look.scale === 1 || p === 0 ? '' : String(1 - (1 - look.scale) * p);
}

/**
 * A <cv-stack> card has no veil element of its own. Without a page colour it darkens through its
 * filter. With `--cv-veil` on the stack (`coloured`) its shadow root paints the colour over each
 * card (`::slotted(*)::after`), at the opacity in the card's `--cv-cover`: the covering progress.
 */
export function writeCardCover(
  card: HTMLElement | SVGElement,
  look: CoverLook,
  p: number,
  coloured = false
): void {
  if (coloured) {
    if (p > 0) card.style.setProperty('--cv-cover', String(+p.toFixed(4)));
    else card.style.removeProperty('--cv-cover');
  } else card.style.filter = p > 0 ? `brightness(${1 - look.veil * p})` : '';
  card.style.scale = look.scale === 1 || p === 0 ? '' : String(1 - (1 - look.scale) * p);
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
