import { chromium, webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Drag the real document scrollbar thumb in both directions, without scripted scroll updates. */
export async function runScrollbarInput({ base, output, engines = ['chromium', 'webkit'] }) {
  await mkdir(output, { recursive: true });
  const rows = [];
  for (const engine of engines) {
    // Playwright's headless Chrome defaults hide native scrollbars, preventing pointer hit tests.
    const browser = await (engine === 'chromium'
      ? chromium.launch({ channel: 'chrome', ignoreDefaultArgs: ['--hide-scrollbars'] })
      : webkit.launch());
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.goto(`${base}/combinations.html`);
      await page.waitForFunction(() => window.fixtureReady);
      await page.evaluate(() => bench.mount({ ids: [4, 12, 30], context: 'zone-fallback' }));
      await page.addStyleTag({
        content:
          'html{overflow-y:scroll;scrollbar-gutter:stable}' +
          '::-webkit-scrollbar{width:16px}::-webkit-scrollbar-track{background:#ddd}' +
          '::-webkit-scrollbar-thumb{background:#555;border-radius:4px}',
      });
      await page.evaluate(() => bench.goTo('middle'));
      await page.waitForTimeout(150);
      const read = () =>
        page.evaluate(() => ({
          y: scrollY,
          height: document.documentElement.scrollHeight,
          vh: innerHeight,
          errors: bench.snapshot().errors,
        }));
      const move = async (state, delta) => {
        const thumb = (state.vh * state.vh) / state.height;
        const center = (state.y / (state.height - state.vh)) * (state.vh - thumb) + thumb / 2;
        await page.mouse.move(1272, center);
        await page.mouse.down();
        await page.mouse.move(1272, center + delta, { steps: 12 });
        await page.mouse.up();
        await page.waitForTimeout(200);
        return read();
      };
      const before = await read(),
        forward = await move(before, 130),
        reverse = await move(forward, -130);
      await page.evaluate(() => bench.unmount());
      const clean = await page.evaluate(() => bench.snapshot());
      rows.push({
        engine,
        before,
        forward,
        reverse,
        pass:
          forward.y > before.y + 100 &&
          reverse.y < forward.y - 100 &&
          !reverse.errors.length &&
          clean.nodes === 0 &&
          clean.animations === 0,
      });
      await writeFile(join(output, 'results.json'), JSON.stringify(rows, null, 2));
    } finally {
      await browser.close();
    }
  }
  return rows;
}
