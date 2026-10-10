import { coverProgress, hides, type CardBox } from './deck';

const card = (rest: number, height = 400, left = 0, width = 400): CardBox => ({
  rest,
  height,
  left,
  width,
});

describe('coverProgress', () => {
  it('runs from the card bottom edge to the next card resting', () => {
    const c = card(0);
    expect(coverProgress(c, 0, 800)).toBe(0);
    expect(coverProgress(c, 0, 400)).toBe(0);
    expect(coverProgress(c, 0, 200)).toBe(0.5);
    expect(coverProgress(c, 0, 0)).toBe(1);
    expect(coverProgress(c, 0, -50)).toBe(1);
  });

  it('measures from the next card rest with a step', () => {
    expect(coverProgress(card(40), 50, 245)).toBe(0.5);
    expect(coverProgress(card(40), 50, 50)).toBe(1);
  });

  it('is a switch when the next card rests below this one', () => {
    expect(coverProgress(card(0, 100), 200, 300)).toBe(0);
    expect(coverProgress(card(0, 100), 200, 200)).toBe(1);
  });
});

describe('hides', () => {
  it('needs the next card on top and at least as large', () => {
    expect(hides(card(0), card(0))).toBe(true);
    expect(hides(card(0), card(0.3))).toBe(true);
    expect(hides(card(0), card(10))).toBe(false);
    expect(hides(card(0), card(0, 300))).toBe(false);
    expect(hides(card(0), card(0, 400, 20, 360))).toBe(false);
    expect(hides(card(10, 380, 20, 360), card(0))).toBe(true);
  });
});
