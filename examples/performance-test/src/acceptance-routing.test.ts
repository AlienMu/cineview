import { describe, expect, it } from 'vitest';
import { parseHashRoute } from './routing';

describe('framework acceptance routing', () => {
  it('exposes private drag and scroll acceptance routes without adding them to curated modes', () => {
    expect(parseHashRoute('#/acceptance/drag')).toBe('acceptance-drag');
    expect(parseHashRoute('#/acceptance/scroll')).toBe('acceptance-scroll');
  });
});
