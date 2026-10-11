import { parseFromTo, parseFx, type Effect, type Source } from '../core/fx';
import { planLayers } from '../render/layers';
import { planFades, splitBlur } from './stills';

const fx = (text: string): Effect[] => parseFx(text, () => undefined);
const plans = (source: Source, text: string) =>
  planLayers(new Map([[source, { effects: fx(text), exits: [] }]]), 'scene');

/** An element holding `html`, laid out at w × h (jsdom has no layout). */
function host(html: string, w = 800, h = 600): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  Object.defineProperty(el, 'offsetWidth', { value: w });
  Object.defineProperty(el, 'offsetHeight', { value: h });
  return el;
}

describe('blur on large pictures (F12)', () => {
  it('splits blur off an effect, keeping its range and curve', () => {
    const [focus] = fx('focus 20% 80%');
    const [rest, blur] = splitBlur(focus!);
    expect(rest!.tracks).toEqual({ opacity: [0.34, 1] });
    expect(rest!.entries.map(([p]) => p)).toEqual(['opacity']);
    expect(blur!.tracks).toEqual({ blur: [4.5, 0] });
    expect([rest!.range, blur!.range, blur!.ease]).toEqual([[0.2, 0.8], [0.2, 0.8], focus!.ease]);
    // Blur alone leaves nothing behind; no blur leaves the effect as it is.
    expect(splitBlur(fx('blur-in')[0]!)[0]!.tracks).toEqual({ opacity: [0, 1] });
    expect(splitBlur(parseFromTo('blur:8px', null, null, () => undefined)!)[0]).toBeNull();
    const [fade] = fx('fade');
    expect(splitBlur(fade!)).toEqual([fade, null]);
  });

  it('moves the blur of a large picture to a fade plan; the layer keeps the rest', () => {
    const layers = plans('view', 'focus(band), drift');
    const fades = planFades(layers, host('<img src="a.png">'));
    expect(fades).toHaveLength(1);
    expect(fades[0]!.blur).toBe(4.5);
    expect(fades[0]!.layer.effects.map((e) => Object.keys(e.tracks))).toEqual([['blur'], ['blur']]);
    expect(layers[0]!.effects.flatMap((e) => Object.keys(e.tracks))).toEqual([
      'opacity',
      'opacity',
      'yp',
    ]);
  });

  it('leaves text, other media, small pictures and blur-free layers alone', () => {
    const cases: Array<[string, HTMLElement]> = [
      ['focus', host('<img src="a.png"><p>Caption</p>')],
      ['focus', host('<img src="a.png"><svg></svg>')],
      ['focus', host('<img src="a.png">', 300, 200)],
      ['focus', host('<p>No picture</p>')],
      ['fade', host('<img src="a.png">')],
    ];
    for (const [text, el] of cases) {
      const layers = plans('enter', text);
      expect(planFades(layers, el)).toEqual([]);
      expect(layers).toEqual(plans('enter', text));
    }
  });
});
