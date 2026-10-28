/** @jest-environment node */
it('imports the public API without a DOM, allowing server-rendered pages to use its exports', async () => {
  const api = await import('./index');
  expect(typeof api.CvStage).toBe('function');
  expect(typeof api.CvVideo).toBe('function');
  expect(api.presetNames()).toContain('fade');
  expect(api.bootCss()).toContain('cv-failsafe');
  expect(api.HEAD_SNIPPET).toContain('cv-js');
});
