#!/usr/bin/env node

/**
 * 构建验证脚本
 * 验证构建输出是否符合要求
 */

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '../dist');
const MAX_BUNDLE_SIZE_KB = 50; // 主包最大 gzip 大小 (KB)

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

function main() {
  log('\n=== CineView 构建验证 ===\n', 'blue');

  let hasErrors = false;

  // 1. 检查 ES 模块
  log('1. 检查 ES 模块输出:', 'yellow');
  const esModule = checkFile('cineview.es.js', 'ES 模块');
  const esModuleGz = checkFile('cineview.es.js.gz', 'ES 模块 (gzipped)');

  if (esModuleGz.exists && esModuleGz.size > MAX_BUNDLE_SIZE_KB) {
    log(
      `  ⚠ 警告: ES 模块 gzip 大小 (${esModuleGz.size} KB) 超过目标 (${MAX_BUNDLE_SIZE_KB} KB)`,
      'yellow'
    );
  }

  // 2. 检查 UMD 模块
  log('\n2. 检查 UMD 模块输出:', 'yellow');
  const umdModule = checkFile('cineview.umd.js', 'UMD 模块');
  const umdModuleGz = checkFile('cineview.umd.js.gz', 'UMD 模块 (gzipped)');

  if (umdModuleGz.exists && umdModuleGz.size > MAX_BUNDLE_SIZE_KB) {
    log(
      `  ⚠ 警告: UMD 模块 gzip 大小 (${umdModuleGz.size} KB) 超过目标 (${MAX_BUNDLE_SIZE_KB} KB)`,
      'yellow'
    );
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
  const chunkFiles = files.filter((f) => f.endsWith('.mjs'));

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

main();
