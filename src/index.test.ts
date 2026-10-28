const tags = ['stage', 'scene', 'animate', 'stack', 'fixed', 'pause', 'video'];
function load() {
  let api!: typeof import('./index');
  jest.isolateModules(() => {
    api = jest.requireActual('./index');
  });
  return api;
}
beforeEach(() =>
  Object.defineProperty(document, 'timeline', { configurable: true, value: { currentTime: 0 } })
);
afterEach(() => {
  document.getElementById('cv-boot-style')?.remove();
  document.documentElement.style.removeProperty('--cv-boot');
});

it('loads without a head stylesheet, registers every public element, and is safe to load twice', () => {
  const api = load();
  const style = document.getElementById('cv-boot-style');
  expect(style?.textContent).toContain('cv-failsafe');
  const constructors = tags.map((name) => customElements.get(`cv-${name}`));
  expect(constructors.every(Boolean)).toBe(true);
  expect(customElements.get('cv-video')).toBe(api.CvVideo);
  expect(api.presetNames()).toContain('rise');
  load();
  expect(tags.map((name) => customElements.get(`cv-${name}`))).toEqual(constructors);
  expect(document.querySelectorAll('#cv-boot-style')).toHaveLength(1);
});

it('keeps a page-provided startup stylesheet instead of adding a second copy', () => {
  document.documentElement.style.setProperty('--cv-boot', '1');
  load();
  expect(document.getElementById('cv-boot-style')).toBeNull();
});
