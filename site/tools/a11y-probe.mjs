// N7 无障碍真机探针。
//
// 静态审查会给「属性写了」发 PASS，而属性写了不等于生效——键盘事件可能被别的层
// 吞掉，inert 可能被后代覆盖，live region 可能被 display:none 踢出无障碍树。
// 这里全部用真浏览器 + 真键盘 + 真无障碍树判定。
//
// 用法：先 `pnpm build` 再起 dev server（站点经 link:../ 消费 dist，不是 src），
// 然后 `node site/tools/a11y-probe.mjs`。BASE 可覆盖。
import { chromium } from 'playwright';
import { inspectCurrentSceneAccessibility } from './scene-accessibility.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4000';
const ROUTE = process.env.ROUTE ?? '/drag';
const results = [];

function check(name, passed, detail) {
  results.push({ name, passed, detail });
  console.log(`${passed ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'load' });
  await page.waitForSelector('[data-cineview-container="true"]', { timeout: 15000 });
  // 场景冷启动链较长，等它落定再判（短等会读到半程状态）。
  await page.waitForTimeout(7000);

  // ── 1. 容器是有名字、可进 Tab 序的 region ────────────────────────────
  const region = await page.evaluate(() => {
    const el = document.querySelector('[data-cineview-container="true"]');
    if (!el) return null;
    return {
      role: el.getAttribute('role'),
      label: el.getAttribute('aria-label'),
      roledescription: el.getAttribute('aria-roledescription'),
      tabIndex: el.tabIndex,
    };
  });
  check(
    '容器是 region 且有可访问名称',
    Boolean(region?.role === 'region' && region?.label),
    JSON.stringify(region)
  );
  check('容器在 Tab 序内', region?.tabIndex === 0, `tabIndex=${region?.tabIndex}`);

  // ── 2. live region 真的在无障碍树里 ─────────────────────────────────
  const live = await page.evaluate(() => {
    const el = document.querySelector('[role="status"]');
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      ariaLive: el.getAttribute('aria-live'),
      text: el.textContent,
      display: cs.display,
      visibility: cs.visibility,
    };
  });
  check('存在 aria-live=polite 的状态区', live?.ariaLive === 'polite', JSON.stringify(live));
  check(
    'live region 未被 display:none / visibility:hidden 踢出无障碍树',
    live !== null && live.display !== 'none' && live.visibility !== 'hidden',
    `display=${live?.display} visibility=${live?.visibility}`
  );

  // ── 3. 真键盘翻页：按 Tab 聚焦容器，再按 PageDown ────────────────────
  await page.evaluate(() => {
    document.querySelector('[data-cineview-container="true"]')?.focus();
  });
  const focusedIsContainer = await page.evaluate(
    () => document.activeElement?.getAttribute('data-cineview-container') === 'true'
  );
  check('容器可获得焦点', focusedIsContainer);

  const before = live?.text ?? '';
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(2500);
  const afterDown = await page.evaluate(
    () => document.querySelector('[role="status"]')?.textContent ?? ''
  );
  check('PageDown 真的翻了页（播报文本变化）', afterDown !== before, `${before} -> ${afterDown}`);

  await page.keyboard.press('PageUp');
  await page.waitForTimeout(2500);
  const afterUp = await page.evaluate(
    () => document.querySelector('[role="status"]')?.textContent ?? ''
  );
  check('PageUp 回退', afterUp === before, `${afterDown} -> ${afterUp}`);

  // ── 4. 非活动场景对辅助技术隐藏，且其内的可聚焦元素不可 Tab 到 ────────
  // 注意断言的范围：**不能**断「所有 aria-hidden 节点都带 inert」。页面作者给纯装饰
  // 元素单独打 aria-hidden 是完全正当的用法（本页就有 bg-ribbon / tp-ambient 等十来个），
  // 那条断言只会把作者的正确用法判成框架的错。框架侧要证的是两件事：
  //   ① 确实有场景被同时标成 inert + aria-hidden（说明这条路径跑到了）；
  //   ② inert 是真的生效，而不只是属性写上了 —— 用 focus() 判定。
  const hidden = await page.evaluate(() => {
    const root = document.querySelector('[data-cineview-container="true"]');
    const inertNodes = Array.from(root?.querySelectorAll('[inert]') ?? []);
    return {
      ariaHiddenTotal: document.querySelectorAll('[aria-hidden="true"]').length,
      inertCount: inertNodes.length,
      allAlsoAriaHidden: inertNodes.every((n) => n.getAttribute('aria-hidden') === 'true'),
      focusEscapes: inertNodes.some((n) => {
        const target = n.querySelector('a[href], button, input, [tabindex]');
        if (!target) return false;
        target.focus();
        return document.activeElement === target;
      }),
    };
  });
  check('存在被隐藏的非活动场景', hidden.inertCount > 0, `inert 节点 ${hidden.inertCount} 个`);
  check('每个 inert 节点同时带 aria-hidden', hidden.allAlsoAriaHidden);
  check('inert 真的挡住了焦点（后代 focus() 无效）', !hidden.focusEscapes);
  const currentScene = await page.evaluate(inspectCurrentSceneAccessibility);
  check(
    '当前场景存在且未被隐藏',
    currentScene.currentSceneFound && !currentScene.currentSceneHidden,
    JSON.stringify(currentScene)
  );

  // ── 5. reduced-motion 下不启动循环动画 ──────────────────────────────
  const reduced = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  });
  const rPage = await reduced.newPage();
  const animationsRunning = [];
  await rPage.goto(`${BASE}${ROUTE}`, { waitUntil: 'load' });
  await rPage.waitForSelector('[data-cineview-container="true"]', { timeout: 15000 });
  await rPage.waitForTimeout(7000);
  // 采样两次相隔 1.2s 的 transform；循环动画会让它变化，静止则不变。
  const sample = () =>
    rPage.evaluate(() =>
      Array.from(document.querySelectorAll('.cineview-animate')).map(
        (el) => getComputedStyle(el).transform + '|' + getComputedStyle(el).opacity
      )
    );
  const s1 = await sample();
  await rPage.waitForTimeout(1200);
  const s2 = await sample();
  const moved = s1.filter((v, i) => v !== s2[i]).length;
  animationsRunning.push(moved);
  check(
    'reduce-motion 下静置 1.2s 无元素自行运动',
    moved === 0,
    `${moved}/${s1.length} 个元素在无输入时仍在变化`
  );
  await reduced.close();
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.passed);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
console.log(failed.length === 0 ? 'VERDICT: PASS' : 'VERDICT: FAIL');
process.exitCode = failed.length === 0 ? 0 : 1;
