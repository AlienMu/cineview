import { CvAnimate } from '../elements/animate';
import type { CvStage } from '../elements/stage';
import { CvScene } from '../elements/scene';
import { Clock } from '../render/clock';
import { EnterController } from './enter';

beforeAll(() => {
  customElements.define('cv-animate', CvAnimate);
  customElements.define('cv-scene', CvScene);
});
beforeEach(() => {
  jest.useFakeTimers();
  Object.defineProperty(HTMLElement.prototype, 'animate', {
    configurable: true,
    value: jest.fn(() => ({
      finished: new Promise(() => undefined),
      cancel: jest.fn(),
      playState: 'running',
      pause: jest.fn(),
      play: jest.fn(),
    })),
  });
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function chain(delay = 0) {
  const scene = document.createElement('cv-scene') as CvScene;
  scene.innerHTML = `<cv-animate name="A" fx="fade" duration="1000" delay="${delay}" replay>A</cv-animate><cv-animate name="B" fx="fade" duration="400" after="A -200" delay="50">B</cv-animate><cv-animate name="C" fx="fade" duration="300" after="B -100">C</cv-animate>`;
  const nodes = [...scene.querySelectorAll('cv-animate')] as CvAnimate[];
  for (const a of nodes) {
    a.scene = scene;
    scene.animates.add(a);
    a.build(a.plan({ timeSource: 'enter', reducedMotion: false }, () => undefined));
    a.getBoundingClientRect = () =>
      ({ top: a === nodes[0] ? 100 : 1800, bottom: a === nodes[0] ? 200 : 1900 }) as DOMRect;
  }
  scene.solve(false);
  const clock = new Clock(),
    controller = new EnterController(clock);
  scene.stage = { clock } as CvStage;
  for (const a of nodes) controller.add(a, { first: false, margins: [50, 50] });
  controller.link();
  return { nodes, clock, controller };
}

it('schedules offscreen followers from the dependency root, retaining negative overlap and own delay', () => {
  const {
    nodes: [a, b, c],
    controller,
  } = chain(100);
  controller.apply(
    controller.measure(() => true),
    800,
    1
  );
  expect(a!.getAttribute('data-cv-phase')).toBe('entering');
  expect(b!.getAttribute('data-cv-phase')).toBe('entering');
  expect(c!.getAttribute('data-cv-phase')).toBe('entering');
  const calls = (HTMLElement.prototype.animate as jest.Mock).mock.calls;
  expect(calls.map(([, timing]) => timing.delay)).toEqual([100, 950, 1250]);
  controller.apply(
    controller.measure(() => true),
    800,
    1
  );
  expect(b!.getAttribute('data-cv-phase')).toBe('entering');
  controller.destroy();
});

it('cancels a pending root together with followers and reschedules one new run', () => {
  const { nodes, controller } = chain(100);
  controller.apply(
    controller.measure(() => true),
    800,
    1
  );
  nodes[0]!.getBoundingClientRect = () => ({ top: 1000, bottom: 1100 }) as DOMRect;
  controller.apply(
    controller.measure(() => true),
    800,
    1
  );
  expect(nodes.map((a) => a.getAttribute('data-cv-phase'))).toEqual(['idle', 'idle', 'idle']);
  nodes[0]!.getBoundingClientRect = () => ({ top: 100, bottom: 200 }) as DOMRect;
  jest.advanceTimersByTime(1000);
  controller.apply(
    controller.measure(() => true),
    800,
    1
  );
  expect(nodes.map((a) => a.getAttribute('data-cv-phase'))).toEqual([
    'entering',
    'entering',
    'entering',
  ]);
  expect((HTMLElement.prototype.animate as jest.Mock).mock.calls).toHaveLength(6);
  controller.destroy();
});

it('uses paused clock time when a root is triggered while the Stage clock is held', () => {
  const {
    nodes: [, b],
    clock,
    controller,
  } = chain(100);
  clock.pause();
  jest.advanceTimersByTime(5000);
  controller.apply(
    controller.measure(() => true),
    800,
    1
  );
  const options = (HTMLElement.prototype.animate as jest.Mock).mock.calls.map(
    ([, options]) => options
  );
  expect(options.map((o) => o.delay)).toEqual([100, 950, 1250]);
  clock.play();
  jest.advanceTimersByTime(100);
  expect(b!.timeline.progress).toBe(0);
  controller.destroy();
});

it('keeps offscreen followers running after an already-started replay root leaves', () => {
  const { nodes, controller } = chain();
  controller.apply(
    controller.measure(() => true),
    800,
    1
  );
  jest.advanceTimersByTime(1200);
  nodes[0]!.getBoundingClientRect = () => ({ top: -200, bottom: -100 }) as DOMRect;
  controller.apply(
    controller.measure(() => true),
    800,
    1
  );
  expect(nodes.map((a) => a.getAttribute('data-cv-phase'))).toEqual([
    'idle',
    'entering',
    'entering',
  ]);
  controller.destroy();
});

it('retains real run origins when a completed root has unfinished offscreen followers at rebuild', () => {
  const { nodes, clock, controller } = chain();
  controller.apply(
    controller.measure(() => true),
    800,
    1
  );
  jest.advanceTimersByTime(1200);
  clock.pause();
  const progress = nodes.map((a) => a.timeline.progress),
    scene = nodes[0]!.scene!;
  controller.destroy();
  for (const a of nodes)
    a.build(a.plan({ timeSource: 'enter', reducedMotion: false }, () => undefined));
  scene.solve(false);
  const rebuilt = new EnterController(clock);
  for (const a of nodes) rebuilt.add(a, { first: false, margins: [50, 50] });
  rebuilt.link();
  expect(nodes.map((a) => a.timeline.progress)).toEqual(progress);
  expect(nodes.map((a) => a.getAttribute('data-cv-phase'))).toEqual([
    'entered',
    'entering',
    'entering',
  ]);
  rebuilt.destroy();
});

function pair() {
  const scene = document.createElement('cv-scene') as CvScene;
  scene.innerHTML = `<cv-animate name="A" fx="fade" duration="1000">A</cv-animate><cv-animate name="B" fx="fade" duration="400" after="A" exit="opacity:0" exit-duration="300">B</cv-animate>`;
  const nodes = [...scene.querySelectorAll('cv-animate')] as CvAnimate[];
  for (const a of nodes) {
    a.scene = scene;
    scene.animates.add(a);
    a.build(a.plan({ timeSource: 'enter', reducedMotion: false }, () => undefined));
  }
  scene.solve(false);
  const clock = new Clock(),
    controller = new EnterController(clock);
  scene.stage = { clock } as CvStage;
  for (const a of nodes) controller.add(a, { first: false, margins: [50, 50] });
  controller.link();
  const place = (a: CvAnimate, top: number) =>
    (a.getBoundingClientRect = () => ({ top, bottom: top + 100 }) as DOMRect);
  const measure = () =>
    controller.apply(
      controller.measure(() => true),
      800,
      1
    );
  return { nodes, controller, place, measure };
}

it('resumes a follower that left with its exit when it comes back, from the same run', () => {
  const {
    nodes: [a, b],
    controller,
    place,
    measure,
  } = pair();
  place(a!, 100);
  place(b!, 300);
  measure();
  expect(b!.getAttribute('data-cv-phase')).toBe('entering');
  jest.advanceTimersByTime(2000);
  place(b!, -300);
  measure();
  expect(b!.getAttribute('data-cv-phase')).toBe('exiting');
  place(b!, 300);
  measure();
  // The run ended while it was away: back on screen it shows its final frame, without the root.
  expect(b!.getAttribute('data-cv-phase')).toBe('entered');
  expect(a!.getAttribute('data-cv-phase')).not.toBe('exiting');
  controller.destroy();
});

it('keeps a follower waiting when its root never started, even with the follower in view', () => {
  const {
    nodes: [a, b],
    controller,
    place,
    measure,
  } = pair();
  place(a!, 1200);
  place(b!, 300);
  measure();
  jest.advanceTimersByTime(1000);
  measure();
  // Neither has started: no phase yet, or idle.
  expect(a!.getAttribute('data-cv-phase') ?? 'idle').toBe('idle');
  expect(b!.getAttribute('data-cv-phase') ?? 'idle').toBe('idle');
  controller.destroy();
});
