#!/usr/bin/env node

/**
 * 构建验证脚本
 * 验证构建输出是否符合要求
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const os = require('os');
const { execFileSync } = require('child_process');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const DIST_DIR = path.join(__dirname, '../dist');
const PACKAGE_JSON = path.join(__dirname, '../package.json');
const MINIFY_SCRIPT =
  process.env.CINEVIEW_MINIFY_SCRIPT || path.join(__dirname, 'minify-library-entries.mjs');
// 预算解析：未提供或空串 → 兜底 50；显式提供（含 '0'）→ 必须是有限数字，否则**响亮失败**。
// 非数字值绝不能静默通过——NaN 落进 `size > budget` 恒 false 等于把尺寸门整个关掉。
const RAW_MAX_BUNDLE_SIZE_KB = process.env.CINEVIEW_MAX_BUNDLE_SIZE_KB;
const MAX_BUNDLE_SIZE_KB =
  RAW_MAX_BUNDLE_SIZE_KB !== undefined && RAW_MAX_BUNDLE_SIZE_KB !== ''
    ? Number(RAW_MAX_BUNDLE_SIZE_KB)
    : 50;
if (
  RAW_MAX_BUNDLE_SIZE_KB !== undefined &&
  RAW_MAX_BUNDLE_SIZE_KB !== '' &&
  !Number.isFinite(MAX_BUNDLE_SIZE_KB)
) {
  console.error(
    `✗ 错误: CINEVIEW_MAX_BUNDLE_SIZE_KB 必须是有限数字 KB 值，当前值: ${JSON.stringify(
      RAW_MAX_BUNDLE_SIZE_KB
    )}`
  );
  process.exit(1);
}
// 显式提供（非空、合法）时是**全产物硬覆盖**，压过清单预算 —— verify-failure-injection
// 靠把它设成 0 来证明尺寸门真的会拒绝超标产物；若只做缺省兜底，清单里带 budgetKB 的
// 产物就永远盖不住，注入失效（门守卫无人验收）。空串视为未提供（不覆盖）。
const BUDGET_OVERRIDE_KB =
  RAW_MAX_BUNDLE_SIZE_KB !== undefined && RAW_MAX_BUNDLE_SIZE_KB !== '' ? MAX_BUNDLE_SIZE_KB : null;

/**
 * 产物清单 —— 由 `scripts/build-all.mjs` 写出 `dist/artifacts.json`。
 *
 * 门必须从清单**派生**，不能手写文件名：手写与实际产物集失同步的后果是静默的。
 * 本轮实测踩过：压缩清单写 3 个、构建实际出 5 个，漏掉的 2 个既没过 terser 也没被
 * 量过，其中一个 47398 字节、距门仅 3.7 KB 却无人看守。
 * 读不到清单即判失败：缺清单意味着无从得知该看守哪些产物。
 */
function readArtifactManifest() {
  const manifestPath = path.join(DIST_DIR, 'artifacts.json');
  if (!fs.existsSync(manifestPath)) {
    log(
      '  ✗ 错误: dist/artifacts.json 不存在 —— 无从得知该看守哪些产物（请先跑 scripts/build-all.mjs）',
      'red'
    );
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!Array.isArray(parsed.artifacts) || parsed.artifacts.length === 0) {
      log('  ✗ 错误: dist/artifacts.json 内容无效（artifacts 为空）', 'red');
      return null;
    }
    return parsed.artifacts.map((a) => ({
      file: a.file,
      module: Boolean(a.module),
      label: a.label || a.file,
      budgetKB: Number(a.budgetKB) || MAX_BUNDLE_SIZE_KB,
    }));
  } catch (error) {
    log(`  ✗ 错误: dist/artifacts.json 解析失败: ${error.message}`, 'red');
    return null;
  }
}

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function getFileSize(filePath) {
  const stats = fs.statSync(filePath);
  return (stats.size / 1024).toFixed(2); // KB
}

function checkFile(fileName, description) {
  const filePath = path.join(DIST_DIR, fileName);
  if (fs.existsSync(filePath)) {
    const size = getFileSize(filePath);
    log(`✓ ${description}: ${fileName} (${size} KB)`, 'green');
    return { exists: true, size: parseFloat(size) };
  } else {
    log(`✗ ${description}: ${fileName} 不存在`, 'red');
    return { exists: false, size: 0 };
  }
}

function hasPublicApiShape(mod) {
  return Boolean(
    mod &&
    typeof mod === 'object' &&
    mod.CineView &&
    mod.Scene &&
    mod.Animate &&
    mod.AnimateVideo &&
    mod.Position &&
    mod.Container &&
    mod.Image
  );
}

function assertAnimateVideoMarkup(mod, label) {
  const markup = renderToStaticMarkup(
    React.createElement(mod.AnimateVideo, {
      src: '/clip.mp4',
      poster: '/poster.jpg',
      'aria-label': 'dist-video',
      preload: false,
      playbackRate: 1.25,
      scrubRange: [0, 6],
      duration: { enter: 200, exit: 100 },
    })
  );
  for (const attribute of [
    'src="/clip.mp4"',
    'poster="/poster.jpg"',
    'aria-label="dist-video"',
    'preload="none"',
  ]) {
    if (!markup.includes(attribute)) {
      throw new Error(`${label} AnimateVideo lost public attribute ${attribute}`);
    }
  }
}

function checkMinifierStrategy() {
  log('\n11. 检查入口压缩策略:', 'yellow');
  try {
    const source = fs.readFileSync(MINIFY_SCRIPT, 'utf8');
    // 压缩清单必须从 `dist/artifacts.json` **派生**，而不是手写文件名 ——
    // 手写与实际产物集失同步时，漏掉的产物会以未压缩状态发布且无人察觉（本轮踩过）。
    // 故这里检查的不再是「列了哪几个名字」，而是「是否从清单派生」。
    const derivesFromManifest =
      source.includes('artifacts.json') && /\.artifacts\s*\.\s*map|artifacts\.map/.test(source);
    const identifierOnly =
      /mangle\s*:\s*\{[^}]*toplevel\s*:\s*true[^}]*\}/s.test(source) &&
      !/\bproperties\s*:/.test(source);
    if (!derivesFromManifest || !identifierOnly) {
      throw new Error(
        'minifier must derive its entry list from dist/artifacts.json and must not enable property mangling'
      );
    }
    log('  ✓ ESM/UMD 仅压缩标识符，公开对象属性保持稳定', 'green');
    return true;
  } catch (error) {
    log(`  ✗ 入口压缩策略失败: ${error.message}`, 'red');
    return false;
  }
}

function checkNoDevDiagnosticsShipped() {
  log('\n12. 检查生产产物不含 dev-only 诊断文案:', 'yellow');
  // 背景：`devWarn` 的函数体被 `esbuild.drop:['console']` 移除，但**传给它的参数
  // 表达式照样求值**。曾有四段 Problem/Fallback/Fix 模板（1191 字节 raw）就这样
  // 入包却永远打印不出来。修法是把文案构造整块放进 NODE_ENV 守卫内。
  // 传 thunk 无效 —— 闭包赋给变量再跨模块传参，esbuild 无法证明其未被使用。
  const markers = ['Problem: ', 'Fallback: ', 'Fix: '];
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(DIST_DIR, 'artifacts.json'), 'utf8'));
    const offenders = [];
    for (const artifact of manifest.artifacts) {
      const filePath = path.join(DIST_DIR, artifact.file);
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, 'utf8');
      for (const marker of markers) {
        const hits = content.split(marker).length - 1;
        if (hits > 0) offenders.push(`${artifact.file} 含 ${hits} 处 "${marker.trim()}"`);
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        `dev 诊断文案泄漏到生产产物: ${offenders.join('; ')}。` +
          "把文案构造移进 if (process.env.NODE_ENV === 'development') 块内"
      );
    }
    log('  ✓ 所有入口均无 dev-only 诊断文案', 'green');
    return true;
  } catch (error) {
    log(`  ✗ 诊断文案检查失败: ${error.message}`, 'red');
    return false;
  }
}

function exportTargets(value) {
  if (typeof value === 'string') return [value];
  if (!value || typeof value !== 'object') return [];
  return Object.values(value).flatMap(exportTargets);
}

function assertExportTargets(pkg, packageRoot) {
  for (const target of exportTargets(pkg.exports)) {
    if (!target.startsWith('./dist/') || target.split('/').includes('..')) {
      throw new Error(`Export target must be a published dist file: ${target}`);
    }
    if (!fs.statSync(path.join(packageRoot, target)).isFile()) {
      throw new Error(`Export target is not a file: ${target}`);
    }
  }
}

function checkPackageExports() {
  log('\n7. 检查 package exports:', 'yellow');
  try {
    const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
    assertExportTargets(pkg, path.dirname(PACKAGE_JSON));
    const rootExport = pkg.exports && pkg.exports['.'];
    const expected = {
      types: './dist/index.d.ts',
      import: './dist/cineview.es.mjs',
      require: './dist/cineview.umd.js',
    };
    // root 的两种格式**能力必须一致**：`import` 与 `require` 都指向全量（按 mode 派发）
    // 产物。曾让 root `require` 指向仅拖拽的产物，导致 CJS 传 `mode="scroll"` 抛错而
    // ESM 正常，且两者共用 `index.d.ts`（含 scroll 分支）⇒ TS 放行、运行时崩。
    //
    // 按模式的子路径**只有 `require`**（无 `import` 条件）：子路径存在的唯一理由是
    // UMD 不能代码拆分，ESM 消费者从 root 拿全量即可。故此处显式断言
    // `import === undefined` —— 若哪天给子路径补了 `import`，必须同时补真实的 ES 产物，
    // 这个断言会把「指向不存在的文件」挡下来。
    const dragExport = pkg.exports && pkg.exports['./drag'];
    const scrollExport = pkg.exports && pkg.exports['./scroll'];
    const subpathsOk =
      dragExport?.types === './dist/entry-drag.d.ts' &&
      dragExport?.import === undefined &&
      dragExport?.require === './dist/cineview-drag.umd.js' &&
      scrollExport?.types === './dist/entry-scroll.d.ts' &&
      scrollExport?.import === undefined &&
      scrollExport?.require === './dist/cineview-scroll.umd.js';

    const passed =
      pkg.types === 'dist/index.d.ts' &&
      pkg.module === 'dist/cineview.es.mjs' &&
      pkg.main === 'dist/cineview.umd.js' &&
      rootExport?.types === expected.types &&
      rootExport?.import === expected.import &&
      rootExport?.require === expected.require &&
      subpathsOk &&
      pkg.exports['./dev']?.types === './dist/dev/index.d.ts' &&
      pkg.exports['./dev']?.import === './dist/cineview-dev.es.mjs' &&
      pkg.exports['./dev/style.css'] === './dist/cineview-dev.css' &&
      Array.isArray(pkg.sideEffects) &&
      pkg.sideEffects.includes('**/*.css');

    if (passed) {
      log('  ✓ package exports/main/module/types 与 dist 产物一致', 'green');
    } else {
      log('  ✗ package exports/main/module/types 与 dist 产物不一致', 'red');
    }

    return passed;
  } catch (error) {
    log(`  ✗ package.json 读取失败: ${error.message}`, 'red');
    return false;
  }
}

async function checkConsumerSmoke() {
  log('\n8. 检查 consumer require/import smoke:', 'yellow');
  let passed = true;

  try {
    const cjs = require(path.join(DIST_DIR, 'cineview.umd.js'));
    if (!hasPublicApiShape(cjs)) {
      throw new Error('UMD export shape missing public components');
    }
    assertAnimateVideoMarkup(cjs, 'UMD');
    log("  ✓ require('cineview') 入口可消费，AnimateVideo 属性语义完整", 'green');
  } catch (error) {
    log(`  ✗ require smoke 失败: ${error.message}`, 'red');
    passed = false;
  }

  try {
    const esm = await import(pathToFileURL(path.join(DIST_DIR, 'cineview.es.mjs')).href);
    if (!hasPublicApiShape(esm)) {
      throw new Error('ESM export shape missing public components');
    }
    assertAnimateVideoMarkup(esm, 'ESM');
    log("  ✓ import('cineview') 入口可消费，AnimateVideo 属性语义完整", 'green');
  } catch (error) {
    log(`  ✗ import smoke 失败: ${error.message}`, 'red');
    passed = false;
  }

  // 按模式的产物也必须逐个 smoke。只测全量入口的话，某个单引擎产物坏了
  // （比如 public-api 的某个导出在那条链上缺失）不会被发现 —— 而它们是
  // 独立的发布产物，消费者会直接加载。
  const modeArtifacts = [
    { file: 'cineview-drag.umd.js', label: "require('cineview/drag')", esm: false },
    { file: 'cineview-scroll.umd.js', label: "require('cineview/scroll')", esm: false },
  ];
  for (const { file, label, esm: isEsm } of modeArtifacts) {
    try {
      const mod = isEsm
        ? await import(pathToFileURL(path.join(DIST_DIR, file)).href)
        : require(path.join(DIST_DIR, file));
      if (!hasPublicApiShape(mod)) {
        throw new Error(`${file} export shape missing public components`);
      }
      assertAnimateVideoMarkup(mod, file);
      log(`  ✓ ${label} 可消费，AnimateVideo 属性语义完整`, 'green');
    } catch (error) {
      log(`  ✗ ${label} smoke 失败: ${error.message}`, 'red');
      passed = false;
    }
  }

  return passed;
}

function checkPeerExternalizationAndSourceMaps() {
  log('\n9. 检查 peer externalization/source maps:', 'yellow');
  try {
    const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
    const viteConfig = fs.readFileSync(path.join(__dirname, '../vite.config.mts'), 'utf8');
    const peerDependencies = Object.keys(pkg.peerDependencies || {});
    const externalizedPeers = peerDependencies.every(
      (dependency) =>
        viteConfig.includes(`'${dependency}'`) || viteConfig.includes(`"${dependency}"`)
    );
    // 每个入口产物的 source map 都要能回溯到 src。清单派生，不手写 ——
    // 漏检某个产物，它的 map 坏了也不会被发现。
    const sourceMapTargets = (readArtifactManifest() ?? []).map((a) => a.file);
    const sourceMaps = sourceMapTargets.map((fileName) => {
      const mapPath = path.join(DIST_DIR, `${fileName}.map`);
      if (!fs.existsSync(mapPath)) return false;
      const sourceMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
      return (
        Array.isArray(sourceMap.sources) &&
        sourceMap.sources.some((source) => source.includes('src/'))
      );
    });

    if (externalizedPeers && sourceMaps.every(Boolean)) {
      log('  ✓ peerDependencies 已由 Vite external，主产物 source map 可回溯到 src', 'green');
      return true;
    }

    log('  ✗ peer externalization 或 source map 审计失败', 'red');
    return false;
  } catch (error) {
    log(`  ✗ peer/source map 审计异常: ${error.message}`, 'red');
    return false;
  }
}

function checkPackedTarballConsumer() {
  log('\n10. 检查 packed tarball consumer:', 'yellow');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cineview-pack-'));
  try {
    const packOutput = execFileSync(
      'npm',
      ['pack', '--json', '--ignore-scripts', '--pack-destination', tempRoot],
      {
        cwd: path.join(__dirname, '..'),
        encoding: 'utf8',
        env: { ...process.env, HUSKY: '0' },
      }
    );
    // npm mixes lifecycle-script stdout into its --json output. The previous
    // heuristic looked for a newline before the opening bracket, which husky 9
    // broke: it prints "HUSKY=0 skip install" with NO trailing newline, so the
    // banner arrives glued to the bracket and the slice started mid-banner
    // ("Unexpected token 'H'"). Parse from the first bracket instead — the
    // banners npm and husky emit contain neither `[` nor `{`.
    const jsonStart = packOutput.search(/[[{]/);
    const packResult = JSON.parse(packOutput.slice(jsonStart >= 0 ? jsonStart : 0));
    const tarballPath = path.join(tempRoot, packResult[0].filename);
    const fixtureRoot = path.join(tempRoot, 'fixture');
    const fixtureModules = path.join(fixtureRoot, 'node_modules');
    fs.mkdirSync(fixtureModules, { recursive: true });
    execFileSync('tar', ['-xzf', tarballPath, '-C', tempRoot]);
    fs.renameSync(path.join(tempRoot, 'package'), path.join(fixtureModules, 'cineview'));

    for (const dependency of Object.keys(require(PACKAGE_JSON).peerDependencies || {})) {
      const source = path.join(__dirname, '..', 'node_modules', dependency);
      const destination = path.join(fixtureModules, dependency);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.symlinkSync(source, destination, 'junction');
    }

    const packedRoot = path.join(fixtureModules, 'cineview');
    const packedPackage = JSON.parse(
      fs.readFileSync(path.join(packedRoot, 'package.json'), 'utf8')
    );
    assertExportTargets(packedPackage, packedRoot);
    if (fs.existsSync(path.join(packedRoot, 'src'))) {
      throw new Error('Packed consumer must resolve published declarations without repository src');
    }
    for (const dependency of ['@types/react', '@types/react-dom']) {
      const destination = path.join(fixtureModules, dependency);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.symlinkSync(
        path.join(__dirname, '..', 'node_modules', dependency),
        destination,
        'junction'
      );
    }

    const consumerScript = [
      "const assert = require('node:assert');",
      "const cjs = require('cineview');",
      "for (const name of ['CineView', 'Scene', 'Animate', 'Position', 'Container', 'Image']) assert.ok(cjs[name], name);",
      "for (const mode of ['drag', 'scroll']) assert.ok(require('cineview/' + mode).CineView, mode);",
      "const React = require('react');",
      "const { renderToStaticMarkup } = require('react-dom/server');",
      "Promise.all([import('cineview'), import('cineview/dev')]).then(([esm, dev]) => {",
      "  for (const name of ['CineView', 'Scene', 'Animate', 'Position', 'Container', 'Image']) assert.ok(esm[name], name);",
      "  assert.equal(typeof dev.PerfPanel, 'function');",
      "  assert.equal(typeof dev.usePerfMonitor, 'function');",
      '  assert.match(renderToStaticMarkup(React.createElement(dev.PerfPanel)), /CineView Performance/);',
      '}).catch((error) => { console.error(error); process.exit(1); });',
    ].join('\n');
    execFileSync(process.execPath, ['-e', consumerScript], {
      cwd: fixtureRoot,
      stdio: 'pipe',
    });
    const typeConsumer = path.join(fixtureRoot, 'consumer.tsx');
    fs.writeFileSync(
      typeConsumer,
      [
        "import { PerfPanel, usePerfMonitor, type PerfPanelProps, type PerformanceSource } from 'cineview/dev';",
        "import type { CineViewRef } from 'cineview';",
        'declare const source: CineViewRef;',
        'const monitor: PerformanceSource = source;',
        'const props: PerfPanelProps = { source: monitor, enabled: true };',
        'export const panel = <PerfPanel {...props} />;',
        'export function Probe() { return usePerfMonitor(monitor)?.current.fps ?? null; }',
        '// @ts-expect-error Invalid positions must remain rejected by the published declarations.',
        'export const invalid = <PerfPanel position="center" />;',
      ].join('\n')
    );
    execFileSync(
      process.execPath,
      [
        require.resolve('typescript/bin/tsc'),
        '--noEmit',
        '--strict',
        '--target',
        'ES2020',
        '--module',
        'ESNext',
        '--moduleResolution',
        'bundler',
        '--jsx',
        'react-jsx',
        '--types',
        'react',
        typeConsumer,
      ],
      { cwd: fixtureRoot, stdio: 'pipe' }
    );

    const browserConsumer = path.join(fixtureRoot, 'browser.mjs');
    fs.writeFileSync(
      browserConsumer,
      [
        "import { PerfPanel } from 'cineview/dev';",
        "import 'cineview/dev/style.css';",
        'export { PerfPanel };',
      ].join('\n')
    );
    const bundled = require('esbuild').buildSync({
      entryPoints: [browserConsumer],
      bundle: true,
      format: 'esm',
      write: false,
      outdir: path.join(fixtureRoot, 'build'),
      external: ['react', 'react/*', 'react-dom', 'framer-motion'],
    });
    const cssOutput = bundled.outputFiles.find((file) => file.path.endsWith('.css'));
    if (!cssOutput?.text.includes('.cineview-perf-panel')) {
      throw new Error('Packed browser consumer lost the exported performance panel CSS');
    }
    log('  ✓ packed tarball 的主/模式/dev 入口、SSR、类型及 CSS 均可消费', 'green');
    return true;
  } catch (error) {
    log(`  ✗ packed tarball consumer 失败: ${error.message}`, 'red');
    return false;
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function main() {
  log('\n=== CineView 构建验证 ===\n', 'blue');

  let hasErrors = false;

  // 0. 产物清单：门的看守范围由它决定，缺失即失败（详见 readArtifactManifest 注释）
  log('0. 读取产物清单:', 'yellow');
  const manifestArtifacts = readArtifactManifest();
  if (!manifestArtifacts) {
    hasErrors = true;
  } else {
    log(`  ✓ dist/artifacts.json：${manifestArtifacts.length} 个产物纳入看守`, 'green');
  }
  const artifacts = manifestArtifacts ?? [];

  // 1. 检查 ES 模块
  log('\n1. 检查 ES 模块输出:', 'yellow');
  const esModule = checkFile('cineview.es.mjs', 'ES 模块');
  const esModuleGz = checkFile('cineview.es.mjs.gz', 'ES 模块 (gzipped)');
  const esBudgetKB =
    BUDGET_OVERRIDE_KB ??
    artifacts.find((a) => a.file === 'cineview.es.mjs')?.budgetKB ??
    MAX_BUNDLE_SIZE_KB;

  if (esModuleGz.exists && esModuleGz.size > esBudgetKB) {
    log(`  ✗ 错误: ES 模块 gzip 大小 (${esModuleGz.size} KB) 超过预算 (${esBudgetKB} KB)`, 'red');
    hasErrors = true;
  }

  const extraEsChecks = artifacts
    .filter((artifact) => artifact.module && artifact.file !== 'cineview.es.mjs')
    .map((artifact) => {
      const js = checkFile(artifact.file, artifact.label);
      const gz = checkFile(`${artifact.file}.gz`, `${artifact.label} (gzipped)`);
      const budgetKB = BUDGET_OVERRIDE_KB ?? artifact.budgetKB;
      if (gz.exists && gz.size > budgetKB) {
        log(
          `  ✗ 错误: ${artifact.label} gzip 大小 (${gz.size} KB) 超过预算 (${budgetKB} KB)`,
          'red'
        );
      }
      return {
        name: `${artifact.label} (≤ ${budgetKB} KB gzip)`,
        passed: js.exists && gz.exists && gz.size <= budgetKB,
      };
    });

  // 2. 检查 UMD 模块（按模式分包）
  //
  // ⚠️ 清单里的每个 UMD 产物都必须量，且用**各自的**预算。UMD 是单文件格式
  // （Rollup 拒绝 UMD + code-splitting），而 `mode` 是运行时 prop，所以**全量** UMD
  // 必然内联两套引擎（实测 51536 字节），结构上不可能塞进 50 KB —— 故它在清单里
  // 单独领 55 KB，而按模式的单引擎产物仍受 50 KB 约束。
  // 漏看任何一个，那个产物就是无人看守的包，下次涨破没人知道。
  log('\n2. 检查 UMD 模块输出（按模式分包）:', 'yellow');
  const umdArtifacts = artifacts
    .filter((a) => !a.module)
    .map((a) => ({ file: a.file, label: a.label, budgetKB: BUDGET_OVERRIDE_KB ?? a.budgetKB }));
  const umdChecked = umdArtifacts.map(({ file, label, budgetKB }) => {
    const mod = checkFile(file, label);
    const gz = checkFile(`${file}.gz`, `${label} (gzipped)`);
    // 缺文件本身就是失败。只在 exists 为真时比大小的话，产物整个没生成会**静默通过**
    // （跳过比较 → 不置位 hasErrors），等于这个包无人看守。
    if (!mod.exists || !gz.exists) {
      log(`  ✗ 错误: ${label} 产物缺失（${!mod.exists ? file : `${file}.gz`}）`, 'red');
      hasErrors = true;
    } else if (gz.size > budgetKB) {
      log(`  ✗ 错误: ${label} gzip 大小 (${gz.size} KB) 超过预算 (${budgetKB} KB)`, 'red');
      hasErrors = true;
    }
    return { file, label, budgetKB, mod, gz };
  });
  const umdModule = umdChecked[0].mod;
  const umdModuleGz = umdChecked[0].gz;
  // 总结行要覆盖**每个** UMD 产物，不能只报第一个的数字。
  const umdSummaryRows = umdChecked.map(({ label, mod, gz, budgetKB }) => ({
    name: `${label}${gz.exists ? ` — ${gz.size} / ${budgetKB} KB` : ''}`,
    passed: mod.exists && gz.exists && gz.size <= budgetKB,
  }));

  // 3. 检查 TypeScript 类型定义（含两个子路径入口的类型）
  log('\n3. 检查 TypeScript 类型定义:', 'yellow');
  const typesDef = checkFile('index.d.ts', 'TypeScript 类型定义');
  // 子路径类型由 scripts/build-all.mjs 生成；package.json 的 exports 指向它们，
  // 缺文件会让 TS 消费者 `import "cineview/drag"` 直接解析失败。
  const dragTypes = checkFile('entry-drag.d.ts', '子路径类型 (cineview/drag)');
  const scrollTypes = checkFile('entry-scroll.d.ts', '子路径类型 (cineview/scroll)');
  if (!dragTypes.exists || !scrollTypes.exists) {
    hasErrors = true;
  }

  // 4. 检查代码分割 - 动画预设
  log('\n4. 检查代码分割 (动画预设):', 'yellow');
  const animationPresets = [
    'fade',
    'slide',
    'zoom',
    'rotate',
    'flip',
    'bounce',
    'blink',
    'shake',
    'blur',
    'elastic',
    'special',
  ];

  const files = fs.readdirSync(DIST_DIR);
  // 三个 ES **入口产物**都要排除，否则按模式的入口会被当成代码分割 chunk 计数
  // （数量虚高，且可能误判某个 preset「有 chunk」）。
  const esEntryArtifacts = new Set(
    artifacts.filter((artifact) => artifact.module).map((artifact) => artifact.file)
  );
  const chunkFiles = files.filter((file) => file.endsWith('.mjs') && !esEntryArtifacts.has(file));

  log(`  找到 ${chunkFiles.length} 个代码分割 chunk:`);
  chunkFiles.forEach((file) => {
    const size = getFileSize(path.join(DIST_DIR, file));
    log(`    - ${file} (${size} KB)`, 'green');
  });

  // 验证每个动画预设是否都有对应的 chunk
  const missingChunks = [];
  animationPresets.forEach((preset) => {
    const hasChunk = chunkFiles.some((f) => f.includes(preset));
    if (!hasChunk) {
      missingChunks.push(preset);
    }
  });

  if (missingChunks.length > 0) {
    log(`  ⚠ 警告: 以下动画预设没有独立的 chunk: ${missingChunks.join(', ')}`, 'yellow');
  }

  // 5. 检查 Gzip 压缩
  log('\n5. 检查 Gzip 压缩文件:', 'yellow');
  const gzFiles = files.filter((f) => f.endsWith('.gz'));
  log(`  找到 ${gzFiles.length} 个 gzip 压缩文件`);

  if (gzFiles.length === 0) {
    log('  ✗ 错误: 没有找到 gzip 压缩文件', 'red');
    hasErrors = true;
  }

  // 6. 检查 Bundle 分析报告
  log('\n6. 检查 Bundle 分析报告:', 'yellow');
  const statsFile = path.join(__dirname, '../stats.html');
  if (fs.existsSync(statsFile)) {
    log('  ✓ Bundle 分析报告已生成: stats.html', 'green');
  } else {
    log('  ✗ 错误: Bundle 分析报告不存在', 'red');
    hasErrors = true;
  }

  const packageExportsPassed = checkPackageExports();
  const consumerSmokePassed = await checkConsumerSmoke();
  const peerAndSourceMapsPassed = checkPeerExternalizationAndSourceMaps();
  const packedTarballPassed = checkPackedTarballConsumer();
  const minifierStrategyPassed = checkMinifierStrategy();
  const noDevDiagnosticsPassed = checkNoDevDiagnosticsShipped();
  hasErrors =
    hasErrors ||
    !packageExportsPassed ||
    !consumerSmokePassed ||
    !peerAndSourceMapsPassed ||
    !packedTarballPassed ||
    !minifierStrategyPassed ||
    !noDevDiagnosticsPassed;

  // 总结
  log('\n=== 验证总结 ===\n', 'blue');

  const checks = [
    { name: 'ES 模块', passed: esModule.exists },
    { name: 'ES 模块 (gzipped)', passed: esModuleGz.exists },
    ...extraEsChecks,
    // 逐个 UMD 产物各占一行（含各自 gzip 尺寸），避免「只报第一个」掩盖另一个的问题。
    ...umdSummaryRows,
    { name: 'TypeScript 类型定义', passed: typesDef.exists },
    { name: '子路径类型 (drag/scroll)', passed: dragTypes.exists && scrollTypes.exists },
    { name: '代码分割', passed: chunkFiles.length > 0 },
    { name: 'Gzip 压缩', passed: gzFiles.length > 0 },
    { name: 'Bundle 分析报告', passed: fs.existsSync(statsFile) },
    { name: 'Package exports', passed: packageExportsPassed },
    { name: 'Consumer smoke', passed: consumerSmokePassed },
    { name: 'Peer/source maps', passed: peerAndSourceMapsPassed },
    { name: 'Packed tarball consumer', passed: packedTarballPassed },
    // 这两道门原先只喂 hasErrors、不进 checks —— 能让构建失败却不出现在计数里。
    { name: '入口压缩策略', passed: minifierStrategyPassed },
    { name: '生产产物无 dev 诊断文案', passed: noDevDiagnosticsPassed },
  ];

  const passedChecks = checks.filter((c) => c.passed).length;
  const totalChecks = checks.length;

  checks.forEach((check) => {
    const icon = check.passed ? '✓' : '✗';
    const color = check.passed ? 'green' : 'red';
    log(`${icon} ${check.name}`, color);
  });

  log(`\n通过: ${passedChecks}/${totalChecks}`, passedChecks === totalChecks ? 'green' : 'red');

  if (esModuleGz.exists) {
    log(`\nES 模块 gzip 大小: ${esModuleGz.size} KB (目标: < ${MAX_BUNDLE_SIZE_KB} KB)`, 'blue');
  }

  if (umdModuleGz.exists) {
    // 逐产物报各自预算（全量 UMD 结构上无法达到 50 KB，单独领 55 —— 见清单注释）
    umdChecked.forEach(({ label, gz, budgetKB }) => {
      if (gz.exists) log(`${label} gzip 大小: ${gz.size} KB (预算: ≤ ${budgetKB} KB)`, 'blue');
    });
  }

  if (hasErrors || passedChecks < totalChecks) {
    log('\n构建验证失败！', 'red');
    process.exit(1);
  } else {
    log('\n✓ 构建验证通过！', 'green');
    process.exit(0);
  }
}

main().catch((error) => {
  log(`\n构建验证异常: ${error.message}`, 'red');
  process.exit(1);
});
