import { entranceDefinition, forgetDone, isDone, markDone, parseReplay } from './replay';

describe('replay', () => {
  it('reads three policies and refuses other strings', () => {
    expect(parseReplay(null)).toBe('default');
    expect(parseReplay('')).toBe('on');
    expect(parseReplay('true')).toBe('on');
    expect(parseReplay(' TRUE ')).toBe('on');
    expect(parseReplay('false')).toBe('once');
    expect(parseReplay('no')).toBeNull();
  });

  it('keeps a completion only for the same entrance definition and scene', () => {
    const el = document.createElement('cv-animate');
    el.setAttribute('fx', 'fade');
    const key = entranceDefinition(el, 's1');
    markDone(el, key);
    expect(isDone(el, entranceDefinition(el, 's1'))).toBe(true);
    expect(isDone(el, entranceDefinition(el, 's2'))).toBe(false);
    el.setAttribute('duration', '900');
    expect(isDone(el, entranceDefinition(el, 's1'))).toBe(false);
    el.removeAttribute('duration');
    forgetDone(el);
    expect(isDone(el, entranceDefinition(el, 's1'))).toBe(false);
  });
});
