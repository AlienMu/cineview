import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const files = process.argv.slice(2);
if (!files.length)
  files.push('DESIGN.md', 'README.md', 'README.zh-CN.md', 'CONTRIBUTING.md', 'RELEASING.md');
const stripCode = (text) => text.replace(/^(```|~~~)[\s\S]*?^\1[^\n]*$/gm, '');
function anchors(text) {
  const found = new Set();
  for (const match of stripCode(text).matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
    const slug = match[1]
      .toLowerCase()
      .replace(/<[^>]*>/g, '')
      .replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '')
      .replace(/\s/g, '-');
    let id = slug;
    for (let suffix = 1; found.has(id); suffix += 1) id = `${slug}-${suffix}`;
    found.add(id);
  }
  for (const match of text.matchAll(/\bid=["']([^"']+)["']/g)) found.add(match[1]);
  return found;
}
let count = 0;
const failures = [];
for (const file of files) {
  const source = path.resolve(root, file);
  for (const match of stripCode(fs.readFileSync(source, 'utf8')).matchAll(
    /\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g
  )) {
    const url = match[1].replace(/^<|>$/g, '');
    if (/^(?:[a-z]+:|\/\/)/i.test(url)) continue;
    const [relative, hash] = url.split('#');
    const target = relative
      ? path.resolve(path.dirname(source), decodeURIComponent(relative))
      : source;
    count += 1;
    if (!fs.existsSync(target)) failures.push(`${file}: missing ${url}`);
    else if (
      hash &&
      /\.mdx?$/.test(target) &&
      !anchors(fs.readFileSync(target, 'utf8')).has(decodeURIComponent(hash))
    )
      failures.push(`${file}: missing anchor ${url}`);
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else console.log(`Documentation links passed (${count} local targets)`);
