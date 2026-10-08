import { bootCss, HEAD_SNIPPET } from './boot';

describe('boot styles', () => {
  const css = bootCss();

  it('has CSS-first keyframes for single time presets only', () => {
    for (const name of ['fade', 'rise', 'grow', 'focus', 'wipe', 'reveal', 'fade-in', 'slide-up']) {
      expect(css).toContain(`@keyframes cv-boot-${name}{`);
    }
    // View-driven presets never play on a clock.
    expect(css).not.toContain('cv-boot-drift');
  });

  it('plays rise with its default duration from its own from-state', () => {
    expect(css).toMatch(/cv-boot-rise 950ms linear both/);
    expect(css).toMatch(/@keyframes cv-boot-rise\{0%\{translate:0px 40px;opacity:0\}/);
  });

  it('gates hiding on .cv-js and keeps CSS-first off for reduced motion', () => {
    expect(css).toMatch(/\.cv-js cv-stage>cv-scene:first-of-type cv-animate:is\(\[fx\],\[from\]\)/);
    expect(css).toMatch(/@media \(prefers-reduced-motion:no-preference\)\{\.cv-js /);
    expect(css).toContain('cv-failsafe 1ms 4000ms both');
  });

  it('registers --cv-unit and parks drag scenes', () => {
    expect(css).toContain('@property --cv-unit{syntax:"<length>"');
    expect(css).toContain('cv-stage[input=drag]>cv-scene:nth-of-type(2){translate:0 100%}');
    expect(css).toContain(':root{--cv-boot:1}');
  });

  it('head snippet only marks .cv-js', () => {
    expect(HEAD_SNIPPET).toContain("classList.add('cv-js')");
    expect(HEAD_SNIPPET).toContain('selector(:has(*))');
  });
});
