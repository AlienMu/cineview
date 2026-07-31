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
const MAX_BUNDLE_SIZE_KB = Number(process.env.CINEVIEW_MAX_BUNDLE_SIZE_KB || 50); // 主包最大 gzip 大小 (KB)

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
    const coversBothEntries =
      source.includes("fileName: 'cineview.es.mjs'") &&
      source.includes("fileName: 'cineview.umd.js'");
    const identifierOnly =
      /mangle\s*:\s*\{[^}]*toplevel\s*:\s*true[^}]*\}/s.test(source) &&
      !/\bproperties\s*:/.test(source);
    if (!coversBothEntries || !identifierOnly) {
      throw new Error('minifier must cover ESM/UMD and must not enable property mangling');
    }
    log('  ✓ ESM/UMD 仅压缩标识符，公开对象属性保持稳定', 'green');
    return true;
  } catch (error) {
    log(`  ✗ 入口压缩策略失败: ${error.message}`, 'red');
    return false;
  }
}

function checkPackageExports() {
  log('\n7. 检查 package exports:', 'yellow');
  try {
    const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
    const rootExport = pkg.exports && pkg.exports['.'];
    const expected = {
      types: './dist/index.d.ts',
      import: './dist/cineview.es.mjs',
      require: './dist/cineview.umd.js',
    };
    const passed =
      pkg.types === 'dist/index.d.ts' &&
      pkg.module === 'dist/cineview.es.mjs' &&
      pkg.main === 'dist/cineview.umd.js' &&
      rootExport?.types === expected.types &&
      rootExport?.import === expected.import &&
      rootExport?.require === expected.require;

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

  return passed;
}

function checkPeerExternalizationAndSourceMaps() {
  log('\n9. 检查 peer externalization/source maps:', 'yellow');
  try {
    const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
    const viteConfig = fs.readFileSync(path.join(__dirname, '../vite.config.ts'), 'utf8');
    const peerDependencies = Object.keys(pkg.peerDependencies || {});
    const externalizedPeers = peerDependencies.every(
      (dependency) =>
        viteConfig.includes(`'${dependency}'`) || viteConfig.includes(`"${dependency}"`)
    );
    const sourceMapTargets = ['cineview.es.mjs', 'cineview.umd.js'];
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
    const jsonStart = packOutput.lastIndexOf('\n[');
    const packResult = JSON.parse(packOutput.slice(jsonStart >= 0 ? jsonStart + 1 : 0));
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

    const consumerScript = [
      "const assert = require('node:assert');",
      "const cjs = require('cineview');",
      "for (const name of ['CineView', 'Scene', 'Animate', 'Position', 'Container', 'Image']) assert.ok(cjs[name], name);",
      "import('cineview').then((esm) => { for (const name of ['CineView', 'Scene', 'Animate', 'Position', 'Container', 'Image']) assert.ok(esm[name], name); }).catch((error) => { console.error(error); process.exit(1); });",
    ].join('\n');
    execFileSync(process.execPath, ['-e', consumerScript], {
      cwd: fixtureRoot,
      stdio: 'pipe',
    });
    log('  ✓ packed tarball 在隔离 consumer 中 require/import 均可消费', 'green');
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

  // 1. 检查 ES 模块
  log('1. 检查 ES 模块输出:', 'yellow');
  const esModule = checkFile('cineview.es.mjs', 'ES 模块');
  const esModuleGz = checkFile('cineview.es.mjs.gz', 'ES 模块 (gzipped)');

  if (esModuleGz.exists && esModuleGz.size > MAX_BUNDLE_SIZE_KB) {
    log(
      `  ✗ 错误: ES 模块 gzip 大小 (${esModuleGz.size} KB) 超过目标 (${MAX_BUNDLE_SIZE_KB} KB)`,
      'red'
    );
    hasErrors = true;
  }

  // 2. 检查 UMD 模块
  log('\n2. 检查 UMD 模块输出:', 'yellow');
  const umdModule = checkFile('cineview.umd.js', 'UMD 模块');
  const umdModuleGz = checkFile('cineview.umd.js.gz', 'UMD 模块 (gzipped)');

  if (umdModuleGz.exists && umdModuleGz.size > MAX_BUNDLE_SIZE_KB) {
    log(
      `  ✗ 错误: UMD 模块 gzip 大小 (${umdModuleGz.size} KB) 超过目标 (${MAX_BUNDLE_SIZE_KB} KB)`,
      'red'
    );
    hasErrors = true;
  }

  // 3. 检查 TypeScript 类型定义
  log('\n3. 检查 TypeScript 类型定义:', 'yellow');
  const typesDef = checkFile('index.d.ts', 'TypeScript 类型定义');

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
  const chunkFiles = files.filter((file) => file.endsWith('.mjs') && file !== 'cineview.es.mjs');

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
  hasErrors =
    hasErrors ||
    !packageExportsPassed ||
    !consumerSmokePassed ||
    !peerAndSourceMapsPassed ||
    !packedTarballPassed ||
    !minifierStrategyPassed;

  // 总结
  log('\n=== 验证总结 ===\n', 'blue');

  const checks = [
    { name: 'ES 模块', passed: esModule.exists },
    { name: 'ES 模块 (gzipped)', passed: esModuleGz.exists },
    { name: 'UMD 模块', passed: umdModule.exists },
    { name: 'UMD 模块 (gzipped)', passed: umdModuleGz.exists },
    { name: 'TypeScript 类型定义', passed: typesDef.exists },
    { name: '代码分割', passed: chunkFiles.length > 0 },
    { name: 'Gzip 压缩', passed: gzFiles.length > 0 },
    { name: 'Bundle 分析报告', passed: fs.existsSync(statsFile) },
    { name: 'Package exports', passed: packageExportsPassed },
    { name: 'Consumer smoke', passed: consumerSmokePassed },
    { name: 'Peer/source maps', passed: peerAndSourceMapsPassed },
    { name: 'Packed tarball consumer', passed: packedTarballPassed },
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
    log(`UMD 模块 gzip 大小: ${umdModuleGz.size} KB (目标: < ${MAX_BUNDLE_SIZE_KB} KB)`, 'blue');
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
