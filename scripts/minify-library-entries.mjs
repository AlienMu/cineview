import { gzipSync } from 'node:zlib';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { minify } from 'terser';

const entries = [
  { fileName: 'cineview.es.mjs', module: true },
  { fileName: 'cineview.umd.js', module: false },
];

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
