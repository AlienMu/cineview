import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

const recipe = readFileSync(join(__dirname, '../../skills/cineview-design/checks.md'), 'utf8')
  .split('## K3 ')[1]
  .match(/```js\n([\s\S]*?)```/)![1];

function page({ restoring = true, stored = '{"id":"film","offset":80}', blocked = false } = {}) {
  const classes = new Set(restoring ? ['restoring'] : []);
  const attrs = new Set(['data-boot-theme']);
  let define!: () => void, ready!: () => void;
  const defined = new Promise<void>((resolve) => {
    define = resolve;
  });
  const stageReady = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const readReady = jest.fn(() => stageReady);
  const stage = {
    get ready() {
      return readReady();
    },
    querySelector: () => null,
  };
  const root = {
    classList: {
      contains: (s: string) => classes.has(s),
      remove: (s: string) => classes.delete(s),
    },
    hasAttribute: (s: string) => attrs.has(s),
    removeAttribute: (s: string) => attrs.delete(s),
  };
  const scrollTo = jest.fn();
  const run = () =>
    runInNewContext(recipe, {
      document: {
        documentElement: root,
        querySelector: () => stage,
        getElementById: () => ({ offsetTop: 1200 }),
      },
      customElements: { whenDefined: () => defined },
      sessionStorage: {
        getItem: () => {
          if (blocked) throw new Error('storage blocked');
          return stored;
        },
      },
      addEventListener: () => undefined,
      requestAnimationFrame: (f: () => void) => f(),
      setTimeout,
      scrollTo,
    });
  return { run, define, ready, readReady, scrollTo, classes, attrs };
}
const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

it.each([true, false])(
  'waits for upgrade and ready before restoring scroll or hash theme (restoring %s)',
  async (restoring) => {
    const p = page({ restoring });
    expect(p.run).not.toThrow();
    expect(p.readReady).not.toHaveBeenCalled();
    p.define();
    await flush();
    expect(p.readReady).toHaveBeenCalledTimes(1);
    expect(p.attrs.has('data-boot-theme')).toBe(true);
    expect(p.scrollTo).not.toHaveBeenCalled();
    p.ready();
    await flush();
    expect(p.classes.has('restoring')).toBe(false);
    expect(p.attrs.has('data-boot-theme')).toBe(false);
    if (restoring) expect(p.scrollTo).toHaveBeenCalledWith(0, 1280);
    else expect(p.scrollTo).not.toHaveBeenCalled();
  }
);

it.each([{}, { stored: '{' }, { blocked: true }])(
  'shows a restoring page if the runtime never defines the stage: %j',
  (config) => {
    const p = page(config);
    expect(p.run).not.toThrow();
    jest.advanceTimersByTime(2500);
    expect(p.classes.has('restoring')).toBe(false);
    expect(p.attrs.has('data-boot-theme')).toBe(false);
    expect(p.scrollTo).not.toHaveBeenCalled();
  }
);
