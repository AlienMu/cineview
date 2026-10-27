import { viewProgress } from '../core/view';
import {
  clearCover,
  COVER_RANGE,
  coverKeyframes,
  parseCovered,
  withVeilColour,
  writeCardCover,
  writeCover,
} from './covered';

describe('parseCovered', () => {
  it('reads dim and recede; absent is null', () => {
    const report = jest.fn();
    expect(parseCovered(null, false, report)).toBeNull();
    expect(parseCovered('dim', false, report)).toEqual({ veil: 0.5, scale: 1 });
    expect(parseCovered(' recede ', false, report)).toEqual({ veil: 0.3, scale: 0.92 });
    expect(report).not.toHaveBeenCalled();
  });

  it('reports other values and ignores them', () => {
    const report = jest.fn();
    expect(parseCovered('fade', false, report)).toBeNull();
    expect(parseCovered('', false, report)).toBeNull();
    expect(report).toHaveBeenCalledTimes(2);
    expect(report.mock.calls[0][0]).toBe('covered="fade": expected dim or recede');
  });

  it('keeps only the veil under reduced motion', () => {
    expect(parseCovered('recede', true, () => undefined)).toEqual({ veil: 0.3, scale: 1 });
  });
});

describe('writeCover', () => {
  const host = document.createElement('div');
  const veil = document.createElement('div');

  it('darkens and scales on the covering progress', () => {
    const look = { veil: 0.3, scale: 0.92 };
    writeCover(host, veil, look, 0.5);
    expect(veil.style.opacity).toBe('0.15');
    expect(Number(host.style.getPropertyValue('scale'))).toBeCloseTo(0.96);
    writeCover(host, veil, look, 0);
    expect(veil.style.opacity).toBe('0');
    expect(host.style.getPropertyValue('scale')).toBe('');
  });

  it('leaves the scale alone when the look does not scale', () => {
    writeCover(host, veil, { veil: 0.5, scale: 1 }, 1);
    expect(veil.style.opacity).toBe('0.5');
    expect(host.style.getPropertyValue('scale')).toBe('');
  });

  it('clears both', () => {
    writeCover(host, veil, { veil: 0.3, scale: 0.92 }, 1);
    clearCover(host, veil);
    expect(veil.style.opacity).toBe('');
    expect(host.style.getPropertyValue('scale')).toBe('');
  });
});

describe('coverKeyframes', () => {
  it('animates the veil, and the scene only when it scales', () => {
    expect(coverKeyframes({ veil: 0.5, scale: 1 })).toEqual({
      veil: [{ opacity: 0 }, { opacity: 0.5 }],
      host: null,
    });
    expect(coverKeyframes({ veil: 0.3, scale: 0.92 }).host).toEqual([
      { scale: '1' },
      { scale: '0.92' },
    ]);
  });
});

describe('COVER_RANGE', () => {
  it("is the next scene's entry: 0 below the screen, 1 once it fills it", () => {
    const vh = 800;
    expect(viewProgress(800, 800, vh, COVER_RANGE)).toBe(0);
    expect(viewProgress(400, 800, vh, COVER_RANGE)).toBe(0.5);
    expect(viewProgress(0, 800, vh, COVER_RANGE)).toBe(1);
    // A next scene taller than the screen fills it once its top reaches the top.
    expect(viewProgress(200, 1400, vh, COVER_RANGE)).toBe(0.75);
    // A shorter one has entered once its bottom is on screen.
    expect(viewProgress(400, 400, vh, COVER_RANGE)).toBe(1);
  });
});

describe('withVeilColour', () => {
  it('keeps the preset strength without a page colour', () => {
    expect(withVeilColour({ veil: 0.5, scale: 1 }, '')).toEqual({ veil: 0.5, scale: 1 });
    expect(withVeilColour({ veil: 0.3, scale: 0.92 }, '  ')).toEqual({ veil: 0.3, scale: 0.92 });
  });
  it('lets the colour carry the strength: the veil opacity is the progress alone', () => {
    const look = withVeilColour({ veil: 0.3, scale: 0.92 }, ' rgb(154 102 64 / 30%) ');
    expect(look).toEqual({ veil: 1, scale: 0.92 });
    expect(coverKeyframes(look).veil).toEqual([{ opacity: 0 }, { opacity: 1 }]);
  });
});

describe('writeCardCover', () => {
  it('darkens a card through its filter without a page colour', () => {
    const card = document.createElement('div');
    writeCardCover(card, { veil: 0.3, scale: 0.92 }, 0.5);
    expect(card.style.filter).toBe('brightness(0.85)');
    expect(card.style.getPropertyValue('--cv-cover')).toBe('');
  });
  it('with a page colour, sets the covering progress for the tint layer and leaves the filter', () => {
    const card = document.createElement('div');
    writeCardCover(card, { veil: 0.3, scale: 0.92 }, 0.5, true);
    expect(card.style.getPropertyValue('--cv-cover')).toBe('0.5');
    expect(card.style.filter).toBe('');
    expect(card.style.scale).toBe('0.96');
    writeCardCover(card, { veil: 0.3, scale: 0.92 }, 0, true);
    expect(card.style.getPropertyValue('--cv-cover')).toBe('');
  });
});
