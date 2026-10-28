import { CvAnimate } from './animate';
import { CvScene } from './scene';
import { loadSplit } from '../text/load';
import { loadCount } from '../text/load-count';
import { loadStills } from '../media/load-stills';
import { loadKeyframes } from '../render/load-keyframes';
import { writeLayer } from '../render/layers';

beforeAll(() => customElements.define('cv-animate', CvAnimate));
beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    value: class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn(() => ({ addEventListener: jest.fn(), removeEventListener: jest.fn() })),
  });
  Object.defineProperty(window, 'SVGGeometryElement', { configurable: true, value: SVGElement });
  Object.defineProperty(window, 'CSS', {
    configurable: true,
    value: { escape: (name: string) => name },
  });
  Object.defineProperty(HTMLElement.prototype, 'animate', {
    configurable: true,
    value: jest.fn(() => ({ finished: new Promise(() => undefined), cancel: jest.fn() })),
  });
});
afterEach(() => {
  document.body.replaceChildren();
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});
function element(attributes: Record<string, string>, html = 'Hello') {
  if (!customElements.get('cv-scene')) customElements.define('cv-scene', CvScene);
  const scene = document.createElement('cv-scene') as CvScene;
  const a = document.createElement('cv-animate') as CvAnimate;
  for (const [key, value] of Object.entries(attributes)) a.setAttribute(key, value);
  a.innerHTML = html;
  scene.append(a);
  document.body.append(scene);
  const report = jest.fn();
  const build = (timeSource: 'scene' | 'enter' = 'scene', reducedMotion = false) => {
    a.build(a.plan({ timeSource, reducedMotion }, report));
    scene.solve(false);
    return a;
  };
  return { a, scene, report, build };
}

it('registers after a late scene upgrade, and reflects React properties assigned before upgrade', async () => {
  const scene = document.createElement('cv-scene');
  const a = document.createElement('cv-animate') as CvAnimate;
  Object.defineProperty(a, 'after', { configurable: true, value: 'title -100' });
  scene.append(a);
  document.body.append(scene);
  customElements.define('cv-scene', CvScene);
  await Promise.resolve();
  expect(a.scene).toBe(scene);
  expect((scene as CvScene).animates.has(a)).toBe(true);
  expect(a.getAttribute('after')).toBe('title -100');
  expect(a.after).toBe(Element.prototype.after);
  const property = a as unknown as { after: unknown };
  property.after = true;
  expect(a.getAttribute('after')).toBe('');
  property.after = false;
  expect(a.hasAttribute('after')).toBe(false);
  property.after = 'next';
  expect(a.getAttribute('after')).toBe('next');
  a.remove();
  expect((scene as CvScene).animates.has(a)).toBe(false);
});

it('keeps a whole-element fallback when a split module has not loaded', () => {
  const { a, build } = element({ fx: 'rise', split: 'words' });
  build();
  expect(a.split).toBeNull();
  expect(a.layers.some((l) => l.source === 'scene')).toBe(true);
  expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('still loading'), a);
});

describe('loaded effects and rebuild cleanup', () => {
  beforeAll(async () => {
    await Promise.all([loadSplit(), loadCount(), loadStills(), loadKeyframes()]);
  });

  it('restores authored SVG stroke settings and isolation when effects are removed', () => {
    const { a, scene, build } = element(
      { fx: 'draw, invert', target: 'path' },
      '<svg><path pathLength="20" style="stroke-dasharray:4 5"></path><path></path></svg>'
    );
    build();
    const paths = [...a.querySelectorAll('path')];
    expect(paths.map((p) => p.getAttribute('pathLength'))).toEqual(['1', '1']);
    expect(paths.map((p) => p.style.strokeDasharray)).toEqual(['1 2', '1 2']);
    expect(scene.shadowRoot!.textContent).toMatch(/isolation:\s*isolate/);
    a.removeAttribute('fx');
    a.removeAttribute('target');
    build();
    expect(paths.map((p) => p.getAttribute('pathLength'))).toEqual(['20', null]);
    expect(paths.map((p) => p.style.strokeDasharray)).toEqual(['4 5', '']);
    expect(scene.shadowRoot!.textContent).not.toMatch(/isolation:\s*isolate/);
  });

  it('stagger targets keep their content and lose owned output when the declaration changes', () => {
    const { a, build } = element(
      { fx: 'fade', stagger: '80' },
      '<ul><li>First</li><li>Second</li></ul>'
    );
    build();
    expect(a.staggerTargets().map((el) => el.textContent)).toEqual(['First', 'Second']);
    expect(a.timeSpec().stagger).toMatchObject({ each: 80, count: 2 });
    for (const layer of a.layers) writeLayer(layer, 0.5, 0);
    expect(a.querySelector('li')!.style.opacity).not.toBe('');
    a.removeAttribute('stagger');
    build();
    expect(a.querySelector('li')!.style.opacity).toBe('');
    a.setAttribute('target', '.selected');
    a.innerHTML = '<i class="selected">A</i><i>B</i>';
    expect(a.staggerTargets()).toHaveLength(1);
    a.removeAttribute('target');
    expect(a.staggerTargets()).toHaveLength(2);
  });

  it('rebuilds image effect containers without retaining old copies', () => {
    const { a, build } = element({ fx: 'focus, duotone(mono), develop' }, '<img src="photo.png">');
    Object.defineProperty(a, 'offsetWidth', { value: 1000 });
    Object.defineProperty(a, 'offsetHeight', { value: 800 });
    build();
    expect(a.shadowRoot!.querySelector('[part=focus-copy]')).not.toBeNull();
    expect(a.shadowRoot!.querySelector('[part=duotone]')).not.toBeNull();
    const copies = [
      ...a.shadowRoot!.querySelectorAll('[part=focus-copy],[part=duotone],[part=develop]'),
    ];
    a.removeAttribute('fx');
    build();
    expect(copies.every((copy) => !copy.isConnected)).toBe(true);
    expect(a.shadowRoot!.querySelector('[part=focus-copy]')).toBeNull();
  });

  it('builds count wheels and restores author text after the effect is removed', () => {
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => new DOMRect(0, 0, 100, 20),
    });
    const { a, build } = element({ fx: 'count' }, '$123');
    build();
    expect(a.timeSpec().duration).toBe(510);
    expect(a.shadowRoot!.querySelector('[part=count-source]')).not.toBeNull();
    expect(a.layers.some((l) => l.adapt !== null)).toBe(true);
    expect(a.textContent).toBe('$123');
    a.removeAttribute('fx');
    build();
    expect(a.shadowRoot!.querySelector('[part=count-source]')).toBeNull();
    expect(a.textContent).toBe('$123');
    a.textContent = 'no number';
    a.setAttribute('fx', 'count');
    build();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('count:'), a);
  });

  it('falls back from unsupported split text without losing the animation or author markup', () => {
    const { a, build } = element({ fx: 'rise', split: 'words' }, '<img alt="Keep this">');
    build();
    expect(a.split).toBeNull();
    expect(a.layers.some((l) => l.source === 'scene')).toBe(true);
    expect(a.querySelector('img')!.alt).toBe('Keep this');
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('more than text'), a);
  });

  it('uses styled font axes and removes movement from reduced-motion clock entrances', () => {
    const { a, build } = element({
      fx: 'axis(wght 200), axis(wdth 75), axis(opsz 8), rise',
      on: 'clock',
      loop: 'pulse',
    });
    a.style.fontWeight = '700';
    a.style.fontStretch = '120%';
    a.style.fontSize = '24px';
    build('enter', true);
    expect(a.timeSpec('clock').duration).toBeLessThanOrEqual(200);
    expect(a.loopItems).toEqual([]);
    const variables = a.layers.flatMap((l) => l.effects.flatMap((e) => e.vars));
    expect(variables.map((v) => [v.name, v.from, v.to])).toEqual(
      expect.arrayContaining([
        ['--cv-axis-wght', 700, 700],
        ['--cv-axis-wdth', 120, 120],
        ['--cv-axis-opsz', 24, 24],
      ])
    );
    expect(a.layers.flatMap((l) => [...l.used])).not.toContain('y');
  });

  it('reports invalid authoring values and warns about timing on position-only sources', () => {
    const { a, report, build } = element({
      fx: 'fade',
      on: 'view(self)',
      ease: 'not-ease',
      replay: 'sometimes',
      split: 'letters',
      duration: '500',
      delay: '20',
      exit: 'fade',
      stagger: '20',
    });
    build();
    expect(report.mock.calls.map(([message]) => message).join('\n')).toMatch(
      /Unknown ease[\s\S]*replay=[\s\S]*split=/
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('nothing on this element follows time'),
      a
    );
    expect(a.timeSpec().exitDuration).toBe(0);
  });

  it('resolves view subjects again after removal and falls back to its scene for missing subjects', () => {
    const { a, scene, build } = element({ fx: 'fade', on: 'view(#subject)' });
    const subject = document.createElement('div');
    subject.id = 'subject';
    scene.append(subject);
    build();
    const layer = a.layers[0]!;
    expect(a.viewSubject(layer)).toBe(subject);
    expect(a.viewSubject(layer)).toBe(subject);
    subject.remove();
    expect(a.viewSubject(layer)).toBe(scene);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('no element with that id'),
      a
    );
    a.setAttribute('on', 'view(self)');
    build();
    expect(a.viewSubject(a.layers[0]!)).toBe(a);
  });
});
