/**
 * 双语文档内容契约（阶段 3 T1.1，task-flow 2026-08-23-stage3-demo-hub-docs）。
 *
 * 独立于 site/src/content/docs/manifest.ts 重新推导（fs 直读，不经 import.meta.glob
 * ——那在 jest 里不存在）：zh/en 目录必须同构、frontmatter 必须带 title、路径必须
 * 落在白名单组内。任何一侧新增页面而另一侧没跟，这里立即红。
 * 违规以「带文件路径的描述串」收集后整批断言，失败信息即整改清单。
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const DOCS_ROOT = join(__dirname, '../../../site/src/content/docs');
const VALID_GROUPS = new Set(['start', 'concepts', 'components', 'animation', 'advanced']);
const LANGS = ['zh', 'en'] as const;

function collectMarkdownFiles(dir: string, prefix = ''): string[] {
  const entries: string[] = [];
  for (const name of readdirSync(dir)) {
    const fullPath = join(dir, name);
    const relative = prefix ? `${prefix}/${name}` : name;
    if (statSync(fullPath).isDirectory()) {
      entries.push(...collectMarkdownFiles(fullPath, relative));
    } else if (name.endsWith('.md')) {
      entries.push(relative);
    }
  }
  return entries;
}

function readFrontmatterTitle(source: string): string | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  if (!match) return null;
  const titleLine = match[1].split(/\r?\n/).find((line) => /^title:\s*\S/.test(line));
  return titleLine ? titleLine.replace(/^title:\s*/, '') : null;
}

describe('docs bilingual content contract', () => {
  const perLang = new Map<string, string[]>(
    LANGS.map((lang) => [lang, collectMarkdownFiles(join(DOCS_ROOT, lang))])
  );

  it('keeps zh and en directory trees isomorphic', () => {
    const zh = new Set(perLang.get('zh'));
    const en = new Set(perLang.get('en'));
    const problems = [
      ...[...en].filter((file) => !zh.has(file)).map((file) => `en 有 zh 无: ${file}`),
      ...[...zh].filter((file) => !en.has(file)).map((file) => `zh 有 en 无: ${file}`),
    ];
    expect(problems).toEqual([]);
    expect(perLang.get('en')).not.toHaveLength(0);
  });

  it('places every page in a whitelisted group with a {group}/{slug}.md path', () => {
    const problems: string[] = [];
    for (const [lang, files] of perLang) {
      for (const file of files) {
        const segments = file.split('/');
        if (segments.length !== 2) {
          problems.push(`${lang}/${file}: 路径必须是 {group}/{slug}.md 两段`);
          continue;
        }
        if (!VALID_GROUPS.has(segments[0])) {
          problems.push(`${lang}/${file}: 未收录的组 ${segments[0]}`);
        }
        if (!/^[a-z0-9-]+\.md$/.test(segments[1])) {
          problems.push(`${lang}/${file}: slug 命名须为小写字母数字连字符`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('declares a non-empty frontmatter title on every page', () => {
    const problems: string[] = [];
    for (const lang of LANGS) {
      for (const file of perLang.get(lang) ?? []) {
        const source = readFileSync(join(DOCS_ROOT, lang, file), 'utf8');
        const title = readFrontmatterTitle(source);
        if (!title) {
          problems.push(`${lang}/${file}: frontmatter 缺非空 title`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
