/**
 * 双语文档清单 —— 阶段 3 文档架构的真源（task-flow 2026-08-23-stage3-demo-hub-docs T1.1）。
 *
 * 内容以 `./{zh,en}/{group}/{slug}.md` 落盘，frontmatter 仅两个键（title/eyebrow），
 * 正文交给 react-markdown 管线。本模块在构建期用 import.meta.glob 把全部 md 以
 * raw 字符串收齐，派生出：每语言页面索引（侧边栏/路由）、单页读取、目录（TOC）标题。
 *
 * 契约（由 src/__tests__/site/docsContent.test.ts 独立复检）：
 * - zh/ 与 en/ 的相对文件集**必须同构**——缺页即构建测试红；
 * - 组内排序按文件名字典序（确定性；需要显式顺序时在文件名上做文章，不引入 order 键）；
 * - 标题在 frontmatter，语言各自维护（不走 i18n DictKey——md 本身就是语言真源）。
 */

export type DocsGroupId = 'start' | 'concepts' | 'components' | 'api' | 'animation' | 'advanced';

export const DOC_GROUP_ORDER: DocsGroupId[] = [
  'start',
  'concepts',
  'components',
  'api',
  'animation',
  'advanced',
];

export type DocsLang = 'zh' | 'en';

export interface DocsPageMeta {
  slug: string;
  group: DocsGroupId;
  title: string;
  eyebrow: string;
  markdown: string;
}

export interface DocsHeading {
  /** 锚点 id，与渲染组件生成的 id 同源（headingId）。 */
  id: string;
  text: string;
  depth: 2 | 3;
}

interface ParsedDocSource {
  title: string;
  eyebrow: string;
  markdown: string;
}

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function parseDocSource(source: string): ParsedDocSource {
  const match = FRONTMATTER_PATTERN.exec(source);
  if (!match) return { title: '', eyebrow: '', markdown: source };
  const meta: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const keyValuePair = /^([a-zA-Z]+):\s*(.*)$/.exec(line);
    if (keyValuePair) meta[keyValuePair[1]] = keyValuePair[2].trim();
  }
  return { title: meta.title ?? '', eyebrow: meta.eyebrow ?? '', markdown: match[2] };
}

/** 标题文本 → 锚点 id。剥离行内标记后按空白连字符化；保留 CJK 原文（浏览器原生支持）。 */
export function headingId(text: string): string {
  return text
    .replace(/[`*_[\]()]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

const rawDocFiles = import.meta.glob<string>('./{zh,en}/*/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const pages = new Map<string, DocsPageMeta>();

for (const [path, source] of Object.entries(rawDocFiles)) {
  // path 形如 './zh/start/introduction.md'
  const segments = /^\.\/(zh|en)\/([a-z]+)\/([a-z0-9-]+)\.md$/.exec(path);
  if (!segments) continue;
  const [, lang, group, slug] = segments;
  const parsed = parseDocSource(source);
  pages.set(`${lang}/${slug}`, {
    slug,
    group: group as DocsGroupId,
    title: parsed.title,
    eyebrow: parsed.eyebrow,
    markdown: parsed.markdown,
  });
}

export function getDocsPage(slug: string, lang: DocsLang): DocsPageMeta | null {
  return pages.get(`${lang}/${slug}`) ?? null;
}

export interface DocsIndexEntry {
  slug: string;
  group: DocsGroupId;
  /** 语言真源标题（md frontmatter），不走 DictKey。 */
  title: string;
}

/** 侧边栏索引：组序按 DOC_GROUP_ORDER，组内按 slug 字典序。 */
export function getDocsIndex(lang: DocsLang): DocsIndexEntry[] {
  return DOC_GROUP_ORDER.flatMap((group) =>
    [...pages.entries()]
      .filter(([key, meta]) => key.startsWith(`${lang}/`) && meta.group === group)
      .map(([, meta]) => meta)
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map((meta) => ({ slug: meta.slug, group: meta.group, title: meta.title }))
  );
}

/** 从 md 源文本提取 h2/h3 目录；id 与渲染组件的 headingId 同源。 */
export function getDocHeadings(markdown: string): DocsHeading[] {
  const headings: DocsHeading[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const match = /^(##|###)\s+(.+)$/.exec(line);
    if (!match) continue;
    const text = match[2].replace(/[`*_[\]()]/g, '').trim();
    headings.push({ id: headingId(text), text, depth: match[1] === '##' ? 2 : 3 });
  }
  return headings;
}
