import { BOARD_GEOMETRY, HINGE, WORD_BAND, WORD_DECOR_BOX } from './particleField';
import { WORD_WALK_MAX } from './wordMotion';

export const CLAPPER_MAX_OPEN_RAD = (34 * Math.PI) / 180;
export const CLAPPER_WORD_DOT_PAD = 0.006;
export const CLAPPER_BOARD_DOT_PAD = 0.009;
export const CLAPPER_WORD_OVERSCAN = WORD_WALK_MAX + CLAPPER_WORD_DOT_PAD;

export type ClapperExtent = {
  minX: number;
  minY: number;
  w: number;
  h: number;
};

/**
 * Full particle hull in board-normalised units. The open stick, settled board,
 * ACTION word, random-walk allowance, and optional word decoration all share this
 * calculation so rendering and acceptance probes cannot drift apart.
 */
export function computeClapperExtent(includeDecor = true): ClapperExtent {
  const g = BOARD_GEOMETRY;
  const cosA = Math.cos(-CLAPPER_MAX_OPEN_RAD);
  const sinA = Math.sin(-CLAPPER_MAX_OPEN_RAD);
  const corners = [
    [g.left, g.barTop],
    [g.right, g.barTop],
    [g.left, g.barBottom],
    [g.right, g.barBottom],
  ].map(([x, y]) => {
    const dx = x - HINGE.x;
    const dy = y - HINGE.y;
    return {
      x: HINGE.x + dx * cosA - dy * sinA,
      y: HINGE.y + dx * sinA + dy * cosA,
    };
  });

  const xs = [
    g.left - CLAPPER_BOARD_DOT_PAD,
    g.right + CLAPPER_BOARD_DOT_PAD,
    WORD_BAND.left - CLAPPER_WORD_OVERSCAN,
    WORD_BAND.right + CLAPPER_WORD_OVERSCAN,
    ...corners.map((corner) => corner.x - CLAPPER_BOARD_DOT_PAD),
    ...corners.map((corner) => corner.x + CLAPPER_BOARD_DOT_PAD),
  ];
  const ys = [
    g.barTop - CLAPPER_BOARD_DOT_PAD,
    g.bodyBottom + CLAPPER_BOARD_DOT_PAD,
    WORD_BAND.top - CLAPPER_WORD_OVERSCAN,
    WORD_BAND.top + WORD_BAND.height + CLAPPER_WORD_OVERSCAN,
    ...corners.map((corner) => corner.y - CLAPPER_BOARD_DOT_PAD),
    ...corners.map((corner) => corner.y + CLAPPER_BOARD_DOT_PAD),
  ];

  if (includeDecor) {
    xs.push(WORD_DECOR_BOX.x0 - CLAPPER_WORD_DOT_PAD, WORD_DECOR_BOX.x1 + CLAPPER_WORD_DOT_PAD);
    ys.push(
      WORD_DECOR_BOX.railTop - WORD_DECOR_BOX.dustRise - CLAPPER_WORD_DOT_PAD,
      WORD_DECOR_BOX.railBottom + CLAPPER_WORD_DOT_PAD
    );
  }

  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    minX,
    minY,
    w: Math.max(...xs) - minX,
    h: Math.max(...ys) - minY,
  };
}

export const CLAPPER_EXTENT = computeClapperExtent();
