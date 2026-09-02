// Docs 真机验收探针（2026-08-27 去比喻化 + Elastic 规则轮；经四轮独立复审加固）
//
// 位置：本文件住在 site/tools/ 而不是 site/scripts/。site/.gitignore:24 忽略的是
// **目录** `scripts`，而 git 对被忽略目录不下降 ⇒ `!scripts/docs-style-probe.mjs`
// 这类否定式对它无效，留在那儿它永远进不了版本库、也就当不了 CI 门。
//
// 两段式：
//
// A. 源文件级结构检查（frontmatter eyebrow、code fence 语言、缩写首用展开）——
//    这些在渲染后的正文里根本看不见，只看 DOM 必然漏。
//
// B. 渲染后可见正文检查（剥掉 pre/code，因为代码里出现术语是正常的）：
//    比喻/漂移词干、Avoid 词表词干、位置指代、英式拼写、第一人称、
//    标题 sentence-case（含 frontmatter title）、引号标点位置、
//    具名小节引用不悬空、正文非空、console 零 error/warning。
//
// 词表一律**写词干**：四轮复审里 `trapped` 因词表只有 `trap`/`traps` 而漏过。
// 「探针 PASS 只证明它查的那些没问题」——每轮复审都在没被列进来的类上 FAIL。
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';

/** 递归列出目录下所有 .md（结构检查用，与 vite glob 无关）。 */
function readdirRecursive(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = `${dir}/${name}`;
    if (statSync(full).isDirectory()) out.push(...readdirRecursive(full));
    else if (full.endsWith('.md')) out.push(full);
  }
  return out;
}

const BASE = process.env.BASE ?? 'http://localhost:4003';
const OUT = 'review/20260827-docs-style';

const METAPHORS = [
  '尺子',
  '闸门',
  '死区',
  '逃生舱',
  '涌现',
  '破窗',
  '打包回滚',
  '翻车',
  '心跳',
  '出血',
  '对号入座',
  '白装',
  // 二轮扩展扫描新发现的同类词（原 12 词表之外）
  '收摊',
  '抢戏',
  // 独立复审补出的：都是「已删裸词但漏了变体」——按词面匹配的固有盲区
  '换算尺', // 尺子的复合词形
  'bundled rollback', // 打包回滚的英译（曾以引号造词留存）
  'crash site', // 故障的比喻式英译
];

// 位置指代：无障碍要求跨引用具名。en 侧不能直接查裸 above/below——
// 「below 40px」「above threshold」是数值比较，合法。所以只匹配**指代文档位置**的搭配。
const POSITIONAL_ZH = ['见下', '见上', '按下表', '下一页', '见前文', '见后文', '上一节', '下一节'];
const POSITIONAL_EN = [
  'see below',
  'see the table below',
  'listed below',
  '(below)',
  'section above',
  'section below',
  'pattern below',
  'snippet below',
  'example below',
  'table above',
  'as described above',
  'as described below',
  'as shown above',
  'as shown below',
  'next section',
  'previous section',
  'the section above',
  // 2026-09-01：原表只收 `as described/shown below`，漏了不带 `as` 的谓语形式。
  // `is detailed below` 就是这样活到第六轮复审的（en/drag/04-ownership.md:28）。
  'detailed below',
  'described below',
  'shown below',
  'explained below',
  'covered below',
  'noted above',
  'mentioned above',
];

// 英式拼写（仅 en）。Elastic 规则要求 American English。
const BRITISH_EN = [
  'behaviour',
  'colour',
  'centre',
  'organis',
  'recognis',
  'serialis',
  'normalis',
  'initialis',
  'neighbour',
  'licence',
  'analyse',
  'cancelling',
  'modelling',
];

// 第一人称（仅 en）。Elastic 规则：用 second person，禁 I/me/my；we 仅限「we recommend」。
// 用词边界 + 排除 `I-frame`/`API`/`ID` 等标识符。
const FIRST_PERSON_EN = /(^|[^\w`-])(I|me|my)([^\w`-]|$)/;

// 已裁决改掉的比喻/漂移词。**写词干**：`trap` 要能命中 `trapped`/`trapping`——
// 四轮复审里 `trapped` 正是因为词表只有 `trap`/`traps` 而漏过（N5 式变体复发）。
const DRIFT_STEMS_EN = [
  'trap',
  'crash site',
  'flap',
  'sharp edge',
  'bundled rollback',
  // 2026-08-27 用户裁决：「编排」改叫「时间线」。slug /docs/04-orchestration 是 URL 保留；
  // 探针只扫渲染后的可见正文（slug 不出现在正文文本里），故这两个词干零命中才算合规。
  'orchestrat',
  'choreograph',
];

// Elastic Avoid 词表 —— **全表**，不只是本站踩过的。
// 四轮复审的规律是「没列进来的那条就是下一轮的 FAIL」，所以宁可全列后逐个加豁免。
// 写词干（`abort` 命中 `aborts`/`aborting`），大小写不敏感。
const AVOID_STEMS_EN = [
  'whitelist',
  'blacklist',
  'abort',
  'cancelled',
  'currently',
  'today',
  'utilize',
  'terminate',
  'launch',
  'boot',
  'invalid',
  // 注：`execute` 已移除——Elastic 针对的是动词 execute，而本站只有名词
  // `execution`（「Computation and execution are separate」），属正常表达。
  'hack',
  'choose',
  'please',
  'easy',
  'easily',
  'simple',
  'simply',
];
// 允许的例外：这些是 API 名/错误码标识符/保留字面量，不是散文用词。
// 探针在剥掉 `code`/`pre` 后的散文上跑，但 API 名也会出现在散文里，故按整词豁免。
const AVOID_EXEMPT_EN = [
  'AbortController',
  'INVALID_ANIMATION',
  'INVALID_DRAG_CONFIG',
  'INVALID_COMPONENT_HIERARCHY',
  'INVALID_SCENE_INDEX',
];
const AVOID_ZH = ['白名单', '黑名单', '目前', '很简单', '只需', '轻松', '编排'];

// ── 2026-08-31 用户裁决「禁止」：推翻 08-27 把 scrub / 轨 列为保留英文词的裁决 ──
// WRITING.md 规则 7（scrub → 「跟随滚动」/「逐帧定位」）与规则 8（轨道隐喻）自此生效。
//
// 为什么先抠再查：`scrubRange` 是真 API 名，写在小标题里时源码不带反引号
// （`## scrubRange 与终点交接`），渲染成 h2 纯文本，不会被 `pre, code` 剔除步骤清掉。
// 整字查 'scrub' 会把它误报成裸用。
const SCRUB_EXEMPT_ZH = [
  'scrubRange',
  'scrubbedOnceRef',
  'framework-scrub',
  'gesture-scrub',
  'scrub.mp4',
];
const BARE_ZH = ['scrub'];

// 「轨」不整字禁：`trackColor` 的「轨道色」、滚动条的「点击轨道」「横向滑轨」指真实
// UI 部件，不是被禁的轨道隐喻。只禁隐喻形态。
const METAPHOR_ZH = ['双轨', '轨道隐喻', '可见性轨', '场景驱动轨', '独立轨'];

// 规则 6：实现词汇不外泄。这些是框架内部标识符（公开 .d.ts 零命中），
// 2026-08-31 用户裁决「清」后全部从散文移除；进表作回归防护。
// 注意：`01-centerlock` / `02-zones-budget` 用表格定义并带公式的量名
// （visualSpan / centerLockOffset / segmentStart / segmentEnd / totalBudgetPx 等）
// 是该页自有词汇，读者要靠它们跟公式，不在此列。
const INTERNAL_IDS = [
  'areScrollSceneRenderSnapshotsEqual',
  'endpointLatched',
  'outgoingLatched',
  'scrubbedOnceRef',
  'applyNativeScrollDelta',
  'applyNativeScrollbarOffset',
  'validateCustomAnimation',
  'parseAnimation',
  'preloadMedia',
  'initialPriorityUrls',
  'priorityComplete',
  'addUrls',
  'hostOffset',
];

// 时态/情态：Elastic 要求现在时。N8 复审把 `will`/`would`/`should` 全部判为违规并清零，
// 三词均进表作回归防护（含反事实用的 would —— 统一改现在时，见 N8 V-2 整改）。
const MODAL_STEMS_EN = ['could', 'will', 'would', 'should'];

const results = [];
const consoleIssues = [];

// ── 源文件级结构检查 ────────────────────────────────────────────────
// 这三项在**渲染后的正文里看不见**（frontmatter 不渲染、fence 语言变成 class、
// 缩写展开要跨页判断），所以在浏览器循环之前直接读源文件。
// 四轮复审的教训：探针只看渲染 prose 就有结构性盲区。
const SRC = 'src/content/docs';
const GROUP_LABEL = {
  'getting-started': 'GETTING STARTED',
  concepts: 'CONCEPTS',
  drag: 'DRAG',
  scroll: 'SCROLL',
  components: 'COMPONENTS',
  advanced: 'ADVANCED',
};

// 2026-08-28 去 AI 味词表（site/src/content/docs/WRITING.md §7 的探针侧）：
// 生造术语、实现词汇外泄、八股小标。用户点名词：旁路/根因/恒为/落点/原子快照/
// 时间常数。散文侧检查（code 里的标识符不受影响）。
const AI_TONE_ZH = [
  '旁路',
  '根因',
  '恒为',
  '落点',
  '原子快照',
  '时间常数',
  '正解',
  '收敛到', // 只禁散文里的流程义，数学义不出现于 docs
  '接管区（takeover', // 已有中文名后又注英文，属于中英夹杂
  'takeover', // zh 散文统一说「锁定区」，不再裸用英文词
  'scrub 轨',
  '可见性轨',
  '场景驱动轨',
  '独立轨',
  // 2026-08-28 二轮：用户复读后新点名的生造词/直译词
  '门控',
  '驻留',
  '帧擦除',
  '擦洗', // scrub 的直译；zh 说「跟随滚动」/「逐帧定位」
  '硬约束',
  '硬规则',
  '硬边界',
  '硬钳',
  '硬编码',
];
// en 对应：lane/root cause 等。`permanently` 太宽（叙述性场景合法），
// 只禁「permanently idle」这个原 AI 句式。
const AI_TONE_EN = [
  'root cause',
  'bypass',
  'time constant',
  'converge',
  'converges',
  'converging',
  'atomic snapshot',
  'permanently idle',
  'scrub lane',
  'visibility lane',
  'independent lane',
  'hijack',
  // 2026-08-28 二轮
  'hard constraint',
  'hard rule',
  'hard boundary',
];
const structural = [];
for (const lang of ['zh', 'en']) {
  for (const p of readdirRecursive(`${SRC}/${lang}`)) {
    const text = readFileSync(p, 'utf8');
    const group = p.split('/').at(-2);
    const rel = `${lang}/${p.split('/').at(-1)}`;

    // 1. frontmatter eyebrow 必须是 `GROUP / TOPIC`，且两语一致
    const eb = /^eyebrow: (.*)$/m.exec(text)?.[1] ?? '';
    const want = GROUP_LABEL[group];
    if (want && !eb.startsWith(`${want} / `))
      structural.push(`${rel}: eyebrow "${eb}" does not start with "${want} / "`);
    const other = readFileSync(p.replace(`/${lang}/`, `/${lang === 'zh' ? 'en' : 'zh'}/`), 'utf8');
    const ebOther = /^eyebrow: (.*)$/m.exec(other)?.[1] ?? '';
    if (eb !== ebOther)
      structural.push(`${rel}: eyebrow differs across locales ("${eb}" vs "${ebOther}")`);

    // 2. 每个开启的 code fence 必须带语言
    let inside = false;
    for (const [n, l] of text.split('\n').entries()) {
      if (!l.startsWith('```')) continue;
      if (!inside) {
        inside = true;
        if (l.trim() === '```') structural.push(`${rel}:${n + 1}: code fence without a language`);
      } else inside = false;
    }
    if (inside) structural.push(`${rel}: unclosed code fence`);

    // 3.5. API 旧名零命中（2026-08-28 改名轮新增）：docs 不得再出现被替换的 prop/回调/错误码。
    // 迁移对照表是唯一合法出现旧名的地方，用 <!-- banned-names:begin --> … end 包住豁免。
    const BANNED_PROPS = [
      /\bwaitFor\b/,
      /\binfiniteAnimation\b/,
      /\breplayOnReenter\b/,
      /\bsceneControlled\b/,
      /\bgetCurrentScene\b/,
      /\bonDragCommit\b/,
      /\bNO_SCENES\b/,
      /\bonSceneWillChange\b/,
      /\bonSceneDidChange\b/,
      /\bDragCommitDetail\b/,
      /\bconfig=\{\{/,
      /\bmodes=\{\{/,
      /\bperformance=\{\{/,
      /\bstack=\{\{/,
      /\blayer=\{\{/,
      /\blayer\.fixed\b/,
    ];
    let exempt = false;
    for (const [n, l] of text.split('\n').entries()) {
      if (l.includes('<!-- banned-names:begin -->')) exempt = true;
      if (l.includes('<!-- banned-names:end -->')) {
        exempt = false;
        continue;
      }
      if (exempt) continue;
      for (const re of BANNED_PROPS)
        if (re.test(l)) structural.push(`${rel}:${n + 1}: legacy API name ${re.source}`);
    }

    // 4b. 内部标识符不进散文（WRITING.md 规则 6；2026-08-31 用户裁决「清」）。
    // 必须在源文件层查，不能查渲染 prose：这些名字在文档里总是写成 `` `xxx` ``，
    // 而 prose 提取那一步会剔除 `pre, code` —— 查 prose 的写法是永不命中的空转
    // （本轮变异验证当场逮到了这一点）。代码块内属正当用法，跳过。
    {
      let fence = false;
      for (const [n, l] of text.split('\n').entries()) {
        if (/^\s*```/.test(l)) {
          fence = !fence;
          continue;
        }
        if (fence) continue;
        for (const id of INTERNAL_IDS)
          if (l.includes(id)) structural.push(`${rel}:${n + 1}: internal identifier ${id}`);
      }
    }

    // 4. 粗体密度（WRITING.md §8.1：≤8/页，剥 code fence 后统计）
    const proseMd = text.replace(/```[\s\S]*?```/g, '');
    const boldCount = (proseMd.match(/\*\*[^*]+\*\*/g) ?? []).length;
    if (boldCount > 8) structural.push(`${rel}: bold density ${boldCount} > 8`);

    // 3. 缩写首次出现必须展开（同一页内），仅 en
    if (lang === 'en') {
      for (const ab of ['LRU', 'CDN', 'rAF', 'ESM', 'CJS', 'UMD']) {
        // 只看散文：剥掉 fenced code 与行内 code —— 缩写出现在文件名
        // （`cineview-drag.umd.js`）或代码里不算散文用词。
        const prose = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
        const first = prose.indexOf(ab);
        if (first < 0) continue;
        // 首次出现处若本身是 `(ABBR)`，说明紧跟在展开写法之后，合规。
        if (prose.slice(first - 1, first + ab.length + 1) === `(${ab})`) continue;
        structural.push(`${rel}: abbreviation ${ab} used before being expanded`);
      }
    }
  }
}

// A 段到此为止。--static / DOCS_STYLE_STATIC=1 时在这里收口：源文件级检查不需要
// 浏览器，也不需要 dev server，因此可以进 `pnpm verify:all`。B 段（渲染后正文）
// 仍然要一个跑着的站点，和 test:browser 一样属于真机通道。
const staticOnly = process.argv.includes('--static') || process.env.DOCS_STYLE_STATIC === '1';
if (staticOnly) {
  // Deliberately writes no evidence file: this mode runs inside `verify:all`, and a
  // per-run artefact would leave the tree dirty — which is what makes
  // `pnpm publish --dry-run` refuse with ERR_PNPM_GIT_UNCLEAN before it ever reaches
  // prepublishOnly. The exit code is the gate; the full browser pass still writes
  // its report under `review/`.
  console.log(`structural issues: ${structural.length}`);
  for (const issue of structural.slice(0, 20)) console.log(`  STRUCT ${issue}`);
  console.log(structural.length === 0 ? 'VERDICT: PASS (static)' : 'VERDICT: FAIL (static)');
  process.exit(structural.length === 0 ? 0 : 1);
}

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') {
    consoleIssues.push({ type: m.type(), text: m.text().slice(0, 200) });
  }
});
page.on('pageerror', (e) =>
  consoleIssues.push({ type: 'pageerror', text: String(e).slice(0, 200) })
);

// 侧栏里拿到全部 slug（真源是运行时渲染出的导航，不是 manifest 静态读取）
await page.goto(`${BASE}/docs`, { waitUntil: 'load' });
await page.waitForSelector('.docs-nav__link');

const slugs = await page.$$eval('.docs-nav__link', (as) =>
  as.map((a) => a.getAttribute('href').replace(/^#?\/docs\//, ''))
);

for (const lang of ['zh', 'en']) {
  // 语言直接写 localStorage（i18n 的真源，见 site/src/i18n/index.tsx:15,37），
  // 避免点 toggle 的时序不确定；随后校验 document.documentElement.lang 真的生效。
  await page.goto(`${BASE}/docs`, { waitUntil: 'load' });
  await page.evaluate((l) => window.localStorage.setItem('cineview-site-lang', l), lang);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.docs-article');
  const htmlLang = await page.$eval('html', (h) => h.getAttribute('lang') ?? '');
  const expected = lang === 'zh' ? 'zh-CN' : 'en';
  if (htmlLang !== expected) {
    throw new Error(`lang seed failed: html lang=${htmlLang}, expected ${expected}`);
  }

  for (const slug of slugs) {
    await page.goto(`${BASE}/docs/${slug}`, { waitUntil: 'load' });
    await page.waitForSelector('.docs-article');
    await page.waitForTimeout(120);

    const probe = await page.evaluate(() => {
      const art = document.querySelector('.docs-article');
      // 只取可见正文：排除代码块（代码里出现术语是正常的）
      const clone = art.cloneNode(true);
      clone.querySelectorAll('pre, code').forEach((n) => n.remove());
      const headings = [...art.querySelectorAll('h2, h3')].map((h) => ({
        id: h.id,
        text: h.textContent.trim(),
      }));
      return {
        title: art.querySelector('h1')?.textContent?.trim() ?? '',
        prose: clone.innerText.replace(/\s+/g, ' ').trim(),
        proseLen: clone.innerText.trim().length,
        headings,
        is404: /^404 \//.test(art.querySelector('.docs-article__meta')?.textContent ?? ''),
      };
    });

    const failures = [];
    if (probe.is404) failures.push('rendered 404 state');
    if (probe.proseLen < 200) failures.push(`prose too short (${probe.proseLen} chars)`);
    const lower = probe.prose.toLowerCase();
    for (const w of METAPHORS) if (lower.includes(w.toLowerCase())) failures.push(`metaphor: ${w}`);
    const positional = lang === 'zh' ? POSITIONAL_ZH : POSITIONAL_EN;
    for (const w of positional)
      if (lower.includes(w.toLowerCase())) failures.push(`positional ref: ${w}`);
    if (lang === 'en') {
      for (const w of BRITISH_EN) if (lower.includes(w)) failures.push(`British spelling: ${w}`);
      // 词干匹配：起始按词边界，结尾允许屈折后缀（trap → trapped/trapping）。
      // 先把豁免的 API 名/错误码整词抠掉，避免 `AbortController` 触发 `abort`。
      let scan = probe.prose;
      for (const ex of AVOID_EXEMPT_EN) scan = scan.split(ex).join('§');
      // 词干后允许 0–4 个字母，覆盖屈折（trap→trapped/trapping、abort→aborts/aborting）
      // 又不至于误报更长的不相关词（trapezoid / bootstrap 实测不命中）。
      // 枚举后缀的写法漏过了双写辅音的 `trapped` —— 这正是四轮复审逮到的那处。
      const stemHit = (stem) =>
        new RegExp(`(^|[^\\w-])${stem}[a-z]{0,4}([^\\w-]|$)`, 'i').test(scan);
      for (const w of DRIFT_STEMS_EN) if (stemHit(w)) failures.push(`term drift: ${w}*`);
      if (FIRST_PERSON_EN.test(probe.prose)) failures.push('first person (I/me/my)');
      for (const w of [...AVOID_STEMS_EN, ...MODAL_STEMS_EN])
        if (stemHit(w)) failures.push(`avoid-list word: ${w}*`);
      // 引号内的逗号/句号必须在引号内侧（Elastic）。只查带标点的成对直引号。
      const quoteOutside = probe.prose.match(/"[^"\n]{2,90}"\s*[,.]/g);
      if (quoteOutside)
        failures.push(
          `punctuation outside quotes: ${quoteOutside.length} (e.g. ${quoteOutside[0].slice(-30)})`
        );
      // 标题 sentence-case：首词之后不该有大写词（专有名词/代码标识符/缩写除外）
      const ALLOW_CAPS = new Set([
        'CineView',
        'Scene',
        'Animate',
        'AnimateVideo',
        'Position',
        'Image',
        'Container',
        'AnimationType',
        'React',
        'TypeScript',
        'JavaScript',
        'DOM',
        'API',
        'APIs',
        'CSS',
        'HTML',
        'JSON',
        'SSR',
        'ESM',
        'ES',
        'UMD',
        'Framer',
        'Motion',
        'Vite',
        'I',
      ]);
      for (const h of [probe.title, ...probe.headings.map((x) => x.text)]) {
        const words = (h.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).slice(1);
        const offenders = words.filter((w) => /^[A-Z]/.test(w) && !ALLOW_CAPS.has(w));
        if (offenders.length > 0)
          failures.push(`Title Case heading: "${h}" (${offenders.join(', ')})`);
      }
    } else {
      for (const w of AVOID_ZH) if (probe.prose.includes(w)) failures.push(`avoid-list word: ${w}`);
      for (const w of AI_TONE_ZH) if (probe.prose.includes(w)) failures.push(`ai-tone word: ${w}`);
      // 裸用英文机制词：先抠掉 API 名（见 SCRUB_EXEMPT_ZH 处的说明）再查
      let zhScan = probe.prose;
      for (const ex of SCRUB_EXEMPT_ZH) zhScan = zhScan.split(ex).join('§');
      for (const w of BARE_ZH)
        if (zhScan.toLowerCase().includes(w)) failures.push(`bare english term: ${w}`);
      for (const w of METAPHOR_ZH)
        if (probe.prose.includes(w)) failures.push(`track metaphor: ${w}`);
    }
    if (lang === 'en') {
      for (const w of AI_TONE_EN)
        if (lower.includes(w.toLowerCase())) failures.push(`ai-tone word: ${w}`);
    }

    // 具名小节引用 → 目标标题必须在同页可见
    const headingTexts = probe.headings.map((h) => h.text);
    const named = [
      ...probe.prose.matchAll(/见「([^」]+)」小节/g),
      ...probe.prose.matchAll(/见 ?([A-Za-z][\w.() -]*?) 小节/g),
      ...probe.prose.matchAll(/see "([^"]+)"/g),
      ...probe.prose.matchAll(/see the "([^"]+)" section/g),
      ...probe.prose.matchAll(/see the ([\w.() -]+?) section/g),
    ].map((m) => m[1].trim());
    for (const t of named) {
      if (!headingTexts.some((h) => h === t || h.includes(t)))
        failures.push(`dangling named ref: "${t}"`);
    }
    if (probe.headings.some((h) => !h.id)) failures.push('heading without anchor id');

    results.push({ lang, slug, title: probe.title, proseLen: probe.proseLen, failures });
  }
}

await browser.close();

mkdirSync(OUT, { recursive: true });
const failed = results.filter((r) => r.failures.length > 0);
const report = {
  base: BASE,
  ranAt: new Date().toISOString(),
  pagesChecked: results.length,
  slugCount: slugs.length,
  failedPages: failed.length,
  structuralIssues: structural,
  consoleIssues,
  failures: failed,
};
writeFileSync(`${OUT}/probe.json`, JSON.stringify(report, null, 2));

console.log(`pages checked: ${results.length} (${slugs.length} slugs x 2 langs)`);
console.log(`structural issues: ${structural.length}`);
for (const s of structural.slice(0, 20)) console.log(`  STRUCT ${s}`);
console.log(`console issues: ${consoleIssues.length}`);
console.log(`failed pages: ${failed.length}`);
for (const f of failed) console.log(`  FAIL ${f.lang}/${f.slug}: ${f.failures.join('; ')}`);
const pass = failed.length === 0 && consoleIssues.length === 0 && structural.length === 0;
console.log(pass ? 'VERDICT: PASS' : 'VERDICT: FAIL');
process.exitCode = pass ? 0 : 1;
