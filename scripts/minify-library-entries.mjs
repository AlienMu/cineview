import { gzipSync } from 'node:zlib';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { minify } from 'terser';

// 清单从 `dist/artifacts.json` **派生**，不再手写。
//
// 为什么：手写清单与实际产物集会失同步，而失同步的后果是静默的 —— 本轮实测踩过：
// 清单写了 3 个入口，构建实际出 5 个，漏掉的 2 个（按模式的 ES）**从未过 terser**，
// 却被 package.json 的 `exports.import` 指向、直接发布。实测其中一个 raw 少 33%，
// 另一个 gzip 47398 字节、距门仅 3.7 KB 且无人看守。
// 现在新增产物只需改 `build-all.mjs` 的 `passes`，压缩与体积门自动跟上。
const manifestPath = path.resolve('dist', 'artifacts.json');
if (!existsSync(manifestPath)) {
  throw new Error(
    'dist/artifacts.json 不存在：请先跑 scripts/build-all.mjs。' +
      '缺清单意味着无从得知该压缩哪些产物，不能静默跳过。'
  );
}
const entries = JSON.parse(await readFile(manifestPath, 'utf8')).artifacts.map((a) => ({
  fileName: a.file,
  module: a.module,
}));

for (const entry of entries) {
  const filePath = path.resolve('dist', entry.fileName);
  const mapPath = `${filePath}.map`;
  const [code, sourceMap] = await Promise.all([
    readFile(filePath, 'utf8'),
    readFile(mapPath, 'utf8'),
  ]);
  const result = await minify(code, {
    module: entry.module,
    compress: { passes: 3 },
    mangle: { toplevel: true },
    sourceMap: {
      content: sourceMap,
      filename: entry.fileName,
      url: `${entry.fileName}.map`,
      asObject: true,
    },
  });

  if (!result.code || !result.map) {
    throw new Error(`Terser did not emit code and a source map for ${entry.fileName}`);
  }

  await Promise.all([
    writeFile(filePath, result.code),
    writeFile(mapPath, JSON.stringify(result.map)),
    writeFile(`${filePath}.gz`, gzipSync(result.code, { level: 9 })),
  ]);
}
