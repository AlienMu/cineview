import { parseExit, parseFromTo, parseFx, type Effect, type Source } from '../core/fx';
import { solveScene } from '../core/time';
import {
  assignWindows,
  buildLayers,
  buildTargetLayers,
  clearLayer,
  compositorLayer,
  planLayers,
  samplesFor,
  writeLayer,
} from './layers';

const fx = (text: string): Effect[] => parseFx(text, () => undefined);
const groups = (entries: Array<[Source, Effect[], Effect[]?]>) =>
  new Map(entries.map(([s, effects, exits]) => [s, { effects, exits: exits ?? [] }]));

describe('planLayers', () => {
  it('nests space → time → clock, with clip layers innermost', () => {
    const plans = planLayers(
      groups([
        ['clock', fx('fade')],
        ['scene', fx('reveal')],
        ['view', fx('drift, wipe')],
      ]),
      'scene'
    );
    expect(plans.map((p) => `${p.kind}:${p.source}`)).toEqual([
      'space:view',
      'time:scene',
      'clock:clock',
      'clip:view',
      'clip:scene',
    ]);
  });

  it('gives view effects one layer per named range, in order of first use', () => {
    const plans = planLayers(
      groups([['view', fx('drift, fade entry, focus(band), wipe exit, grow entry')]]),
      '#hero'
    );
    expect(plans.map((p) => `${p.kind}:${p.range?.[0].name ?? 'all'}:${p.effects.length}`)).toEqual(
      ['space:all:3', 'space:entry:2', 'clip:exit:1']
    );
    expect(plans.every((p) => p.subject === '#hero')).toBe(true);
  });

  it('gives custom properties a layer of their own source, kept off the compositor', () => {
    const vars = parseFromTo('--glow:0', '--glow:1', null, () => undefined)!;
    const plans = planLayers(
      groups([
        ['view', [vars]],
        ['scene', fx('wipe')],
      ]),
      'scene'
    );
    expect(plans.map((p) => `${p.kind}:${p.source}`)).toEqual(['space:view', 'clip:scene']);
    const host = document.createElement('div');
    const [space, clip] = buildLayers(host, plans);
    expect([...space!.vars]).toEqual(['--glow']);
    expect(clip!.vars.size).toBe(0);
    expect(compositorLayer(space!)).toBe(false);
    expect(
      compositorLayer(buildLayers(host, planLayers(groups([['view', fx('drift')]]), 'scene'))[0]!)
    ).toBe(true);
    // Clock-played: a keyframe per 60 Hz frame (an unregistered property steps between them).
    expect(samplesFor(space!, 600)).toBe(36);
    expect(samplesFor(space!, 100)).toBe(12);
    writeLayer(space!, 0.5, 0);
    expect(space!.el.style.getPropertyValue('--glow')).toBe('0.5');
    clearLayer(space!);
    expect(space!.el.style.getPropertyValue('--glow')).toBe('');
  });

  it('puts clip-only exits on a clip layer of the time source', () => {
    const plans = planLayers(
      groups([['scene', fx('fade'), parseExit('wipe', null, () => undefined)]]),
      'scene'
    );
    expect(plans.map((p) => p.kind)).toEqual(['time', 'clip']);
  });
});

describe('buildLayers', () => {
  it('nests layer divs around a slot, applying a push focus as transform-origin', () => {
    const host = document.createElement('div');
    const layers = buildLayers(
      host,
      planLayers(groups([['scene', fx('push(in, 20% 30%)')]]), 'scene')
    );
    expect(layers).toHaveLength(1);
    expect(layers[0]!.el.style.transformOrigin).toBe('20% 30%');
    expect(host.shadowRoot!.querySelector('.l > slot')).not.toBeNull();
  });
});

describe('stagger targets', () => {
  const setup = () => {
    const children = [0, 1, 2].map(() => document.createElement('span'));
    const [plan] = planLayers(groups([['scene', fx('reveal')]]), 'scene');
    const layers = buildTargetLayers(children, plan!);
    const solved = solveScene([
      {
        name: null,
        duration: 400,
        delay: 100,
        after: null,
        at: null,
        exitDuration: 200,
        stagger: { each: 100, from: 'first', count: 3 },
      },
    ]).byIndex[0]!;
    assignWindows(layers, solved);
    return { children, layers };
  };

  it('gives each child its slice of the element window, exits included', () => {
    const { layers } = setup();
    // Element: [100, 700] entrance, [700, 900] exit; span 600 = tail 200 + item 400.
    // Child k occupies [k/6, (k + 4)/6] of each window.
    const want = [0, 1, 2].map((k) => [
      100 + (600 * k) / 6,
      100 + (600 * (k + 4)) / 6,
      700 + (200 * k) / 6,
      700 + (200 * (k + 4)) / 6,
    ]);
    layers.forEach((l, k) => {
      const w = l.window!;
      [w.start, w.end, w.exitStart, w.exitEnd].forEach((v, i) =>
        expect(v).toBeCloseTo(want[k]![i]!, 9)
      );
    });
  });

  it('writes only safe properties on author elements; the rest as variables, all undoable', () => {
    const { children, layers } = setup();
    writeLayer(layers[0]!, 0.5, 0);
    const style = children[0]!.style;
    expect(style.getPropertyValue('--cv-filter')).toMatch(/^blur\(/);
    expect(style.getPropertyValue('--cv-clip-path')).toMatch(/^inset\(/);
    expect(style.filter).toBe('');
    expect(style.opacity).not.toBe('');
    clearLayer(layers[0]!);
    expect(children[0]!.getAttribute('style') ?? '').toBe('');
  });
});
