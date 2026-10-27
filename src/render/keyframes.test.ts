import { readKeyframes, toKeyframes } from './keyframes';

const sheets: HTMLStyleElement[] = [];
function css(text: string): void {
  const style = document.createElement('style');
  style.textContent = text;
  document.head.append(style);
  sheets.push(style);
}
const collect = (): { report: (m: string, code?: string) => void; messages: string[] } => {
  const messages: string[] = [];
  return { report: (m, code) => messages.push(code ? `${code}: ${m}` : m), messages };
};

afterEach(() => {
  for (const s of sheets.splice(0)) s.remove();
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe('keyframes(name): the page rule as keyframe data (plan v3 §3.3)', () => {
  it('reads offsets, merges equal ones and carries timing and composition', () => {
    css(`@keyframes pop {
      from { opacity: 0; float: left; offset-distance: 10%; --glow: 0 }
      40%, 80% { opacity: .5 !important; transform: scale(1.2); animation-timing-function: steps(2) }
      80% { color: red; animation-composition: add; animation-duration: 3s }
      to { opacity: 1; -webkit-text-stroke-width: 2px }
    }`);
    const { report, messages } = collect();
    expect(readKeyframes(document.body, 'pop', 'ease-in', report)).toEqual([
      {
        easing: 'ease-in',
        opacity: '0',
        cssFloat: 'left',
        offsetDistance: '10%',
        '--glow': '0',
        offset: 0,
      },
      { easing: 'steps(2)', transform: 'scale(1.2)', offset: 0.4 },
      { easing: 'steps(2)', transform: 'scale(1.2)', color: 'red', composite: 'add', offset: 0.8 },
      { easing: 'ease-in', opacity: '1', webkitTextStrokeWidth: '2px', offset: 1 },
    ]);
    expect(messages).toEqual([]);
  });

  it('takes the last rule of the name whose conditions hold', () => {
    window.matchMedia = ((q: string) => ({ matches: q.includes('min-width') })) as never;
    css('@keyframes a { to { opacity: .1 } }');
    css('@media (min-width: 1px) { @keyframes a { to { opacity: .2 } } }');
    css('@media (max-width: 1px) { @keyframes a { to { opacity: .3 } } }');
    css('@layer base { @keyframes b { to { opacity: .4 } } }');
    const quiet = collect().report;
    expect(readKeyframes(document.body, 'a', 'linear', quiet)?.[0]?.opacity).toBe('.2');
    expect(readKeyframes(document.body, 'b', 'linear', quiet)?.[0]?.opacity).toBe('.4');
  });

  it('reports a missing rule, and timeline-range selectors it cannot place', () => {
    css('@keyframes r { 0% { opacity: 0 } 100% { opacity: 1 } }');
    const { report, messages } = collect();
    expect(readKeyframes(document.body, 'nope', 'linear', report)).toBeNull();
    const rule = document.styleSheets[0]!.cssRules[0] as CSSKeyframesRule;
    Object.defineProperty(rule.cssRules[0]!, 'keyText', { value: 'entry 0%' });
    expect(toKeyframes(rule, 'linear', report)).toEqual([
      { easing: 'linear', opacity: '1', offset: 1 },
    ]);
    expect(messages).toEqual([
      "unknown-keyframes: keyframes(nope): no @keyframes nope in the page's stylesheets",
      'keyframes(r): "entry 0%" names a timeline range; give the fx item a range instead',
    ]);
  });
});
