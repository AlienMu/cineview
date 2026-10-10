/**
 * <cv-stack> geometry (plan v3 §9.3, lexicon #6): pure functions over measured card boxes. A card
 * rests at `rest` (px from the top of the screen: its sticky top, or its slot in the dealt deck);
 * the next card covers it from the moment its top meets this card's bottom edge until it rests.
 */

export interface CardBox {
  /** Resting top, px from the screen's top edge. */
  rest: number;
  height: number;
  left: number;
  width: number;
}

/** Covering progress (0–1) of a card by the next one, whose top is at `nextTop`. */
export function coverProgress(card: CardBox, nextRest: number, nextTop: number): number {
  const from = card.rest + card.height;
  if (from <= nextRest) return nextTop <= nextRest ? 1 : 0;
  return Math.min(1, Math.max(0, (from - nextTop) / (from - nextRest)));
}

/** Resting, the next card hides this one entirely (`step` 0 and at least as large): skip painting. */
export function hides(card: CardBox, next: CardBox): boolean {
  return (
    next.rest <= card.rest + 0.5 &&
    next.rest + next.height >= card.rest + card.height - 0.5 &&
    next.left <= card.left + 0.5 &&
    next.left + next.width >= card.left + card.width - 0.5
  );
}
