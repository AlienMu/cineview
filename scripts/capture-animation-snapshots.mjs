import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import playwright from '../site/node_modules/playwright/index.js';

const { chromium } = playwright;

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, values) => {
    if (!value.startsWith('--')) return pairs;
    const next = values[index + 1];
    pairs.push([value.slice(2), next && !next.startsWith('--') ? next : true]);
    return pairs;
  }, [])
);

const label = String(args.label || 'baseline');
const port = Number(args.port || 3000);
const baseUrl = `http://127.0.0.1:${port}`;
const outDir = path.resolve('output/playwright', `animation-${label}`);
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const dragSelectors = [
  '.s01-dial',
  '.s01-title-area',
  '.s02-light',
  '.s02-stage',
  '.s03-preview',
  '.s03-bed',
  '.s04-clock',
  '.s04-label',
  '.s05-curtain-call',
  '.s05-credits',
  '.s05-the-end',
];

const homeSelectors = [
  '.hero__stack',
  '.hero__scroll-hint',
  '.capability-full--film',
  '.film-gate',
  '.capability-full--stage',
  '.stage-frame',
  '.demo-video',
  '.demo-video__subtitle',
  '.scene5-cinema',
  '.phone-mockup',
];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const report = {
  label,
  baseUrl,
  outDir,
  captures: [],
  consoleMessages: [],
  pageErrors: [],
};

async function collectLayout(page, selectors) {
  return page.evaluate((requestedSelectors) => {
    const round = (value) => Number(value.toFixed(2));
    const elements = Object.fromEntries(
      requestedSelectors.map((selector) => {
        const element = document.querySelector(selector);
        if (!(element instanceof HTMLElement)) return [selector, null];
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return [
          selector,
          {
            x: round(rect.x),
            y: round(rect.y),
            width: round(rect.width),
            height: round(rect.height),
            opacity: style.opacity,
            visibility: style.visibility,
            transform: style.transform,
            filter: style.filter,
          },
        ];
      })
    );
    const scenes = [...document.querySelectorAll('[data-scene-index]')].map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        index: Number(element.getAttribute('data-scene-index')),
        top: round(rect.top),
        bottom: round(rect.bottom),
      };
    });
    const current = scenes.reduce(
      (best, scene) => (Math.abs(scene.top) < Math.abs(best.top) ? scene : best),
      scenes[0]
    );
    return {
      currentScene: current?.index ?? -1,
      viewport: { width: innerWidth, height: innerHeight },
      elements,
      scenes,
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
    };
  }, selectors);
}

async function capture(page, viewportName, routeName, sceneName, selectors) {
  const filename = `${routeName}-${viewportName}-${sceneName}.png`;
  const filePath = path.join(outDir, filename);
  const layout = await collectLayout(page, selectors);
  await page.screenshot({ path: filePath, animations: 'allow' });
  report.captures.push({ filename, viewportName, routeName, sceneName, layout });
}

async function slowDrag(page, viewport, fromRatio, toRatio) {
  const x = viewport.width / 2;
  const fromY = viewport.height * fromRatio;
  const toY = viewport.height * toRatio;
  await page.mouse.move(x, fromY);
  await page.mouse.down();
  for (let step = 1; step <= 24; step += 1) {
    await page.mouse.move(x, fromY + ((toY - fromY) * step) / 24);
    await page.waitForTimeout(24);
  }
  await page.mouse.up();
}

async function assertDragScene(page, expected, context) {
  const layout = await collectLayout(page, []);
  const scene = layout.scenes.find((entry) => entry.index === expected);
  if (layout.currentScene !== expected || !scene || Math.abs(scene.top) > 2) {
    throw new Error(`${context}: expected scene ${expected}, got ${JSON.stringify(layout.scenes)}`);
  }
}

async function captureDrag(page, viewport) {
  await page.goto(`${baseUrl}/drag`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.drag-temporal');
  await page.waitForTimeout(7200);
  await assertDragScene(page, 0, `${viewport.name} act 1`);
  await capture(page, viewport.name, 'drag', 'act-1', dragSelectors);

  const settleWaits = [0, 7200, 8200, 6200, 7200];
  for (let target = 1; target <= 4; target += 1) {
    await slowDrag(page, viewport, 0.84, 0.14);
    await page.waitForTimeout(1500 + settleWaits[target]);
    await assertDragScene(page, target, `${viewport.name} act ${target + 1}`);
    await capture(page, viewport.name, 'drag', `act-${target + 1}`, dragSelectors);
  }
}

async function setHomeSceneToEnd(page, sceneIndex) {
  let state;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    state = await page.evaluate((index) => {
      const container = document.querySelector('[data-cineview-container="true"]');
      const shell = document.querySelector(`[data-cineview-takeover-shell="${index}"]`);
      const nextScene = document.querySelector(`[data-scene-index="${index + 1}"]`);
      if (!(container instanceof HTMLElement) || !(shell instanceof HTMLElement)) {
        throw new Error(`Missing scroll owner or scene shell ${index}`);
      }
      const containerRect = container.getBoundingClientRect();
      const shellRect = shell.getBoundingClientRect();
      const nextTop = nextScene?.getBoundingClientRect().top ?? null;
      return {
        atTop: Math.abs(shellRect.top - containerRect.top) <= 2,
        atEnd:
          nextTop == null
            ? container.scrollTop >= container.scrollHeight - container.clientHeight - 2
            : nextTop <= containerRect.bottom + 2,
        nextTop,
        scrollTop: container.scrollTop,
      };
    }, sceneIndex);
    if (state.atTop && state.atEnd) break;
    await page.mouse.wheel(0, 1000);
    await page.waitForTimeout(24);
  }
  if (!state?.atTop || !state.atEnd) {
    throw new Error(`Failed to settle home scene ${sceneIndex}: ${JSON.stringify(state)}`);
  }
  await page.waitForTimeout(1600);
}

async function captureHome(page, viewport) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.home-scene-canvas');
  await page.waitForTimeout(4200);
  await capture(page, viewport.name, 'home', 'scene-1', homeSelectors);

  for (let target = 1; target <= 4; target += 1) {
    await setHomeSceneToEnd(page, target);
    await capture(page, viewport.name, 'home', `scene-${target + 1}`, homeSelectors);
  }
}

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        report.consoleMessages.push({
          viewport: viewport.name,
          type: message.type(),
          text: message.text(),
        });
      }
    });
    page.on('pageerror', (error) => {
      report.pageErrors.push({ viewport: viewport.name, text: String(error) });
    });

    await captureDrag(page, viewport);
    await captureHome(page, viewport);
    await context.close();
  }
} catch (error) {
  report.failure = String(error?.stack ?? error);
} finally {
  await browser.close();
  await writeFile(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
}

console.log(
  JSON.stringify(
    {
      outDir,
      captures: report.captures.length,
      consoleMessages: report.consoleMessages.length,
      pageErrors: report.pageErrors.length,
      failure: report.failure,
    },
    null,
    2
  )
);

if (report.failure) process.exitCode = 1;
