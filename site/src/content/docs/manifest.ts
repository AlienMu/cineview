/**
 * Bilingual documentation manifest — the source of truth for Stage 3 documentation architecture (task-flow 2026-08-23-stage3-demo-hub-docs T1.1).
 *
 * Content is stored as `./{zh,en}/{group}/{slug}.md`, with frontmatter containing only two keys (title/eyebrow),
 * and the body handled by the react-markdown pipeline. During build, this module uses import.meta.glob to
 * collect all md files as raw strings, then derives: per-language page index (sidebar/routing), single page retrieval, and TOC headings.
 *
 * Contract (independently verified by src/__tests__/site/docsContent.test.ts):
 * - zh/ and en/ relative file sets **must be isomorphic** — missing pages fail build tests;
 * - Within-group ordering is by filename lexicographic order (deterministic; when explicit order is needed, encode it in filenames rather than introducing an order key);
 * - Titles live in frontmatter, maintained per-language (not via i18n DictKey — md itself is the language source of truth).
 */

import { parseDocSource } from './frontmatter';

export type DocsGroupId =
  'getting-started' | 'concepts' | 'drag' | 'scroll' | 'components' | 'advanced';

/**
 * Group order for sidebar and routing. drag / scroll groups carry dedicated chapters for their respective engines,
 * positioned after concepts and before reference — readers establish concepts first, dive deep into the engine
 * they're using, then consult the API.
 *
 * ⚠️ When adding a new group, four places must be synchronized; missing any produces different failure modes:
 *   1. DocsGroupId union in this file
 *   2. DOC_GROUP_ORDER in this file (missing → pages from that group don't appear in sidebar index)
 *   3. GROUP_KEY_BY_ID in DocsPage.tsx (Record<DocsGroupId,…>, missing → type-check failure)
 *   4. GROUPS in DocsPage.tsx (bare array with no exhaustiveness check, missing → group silently doesn't render)
 * Also sync i18n (zh first, en second, else en.ts fails Dict type) and VALID_GROUPS in contract tests.
 */
export const DOC_GROUP_ORDER: DocsGroupId[] = [
  'getting-started',
  'concepts',
  'drag',
  'scroll',
  'components',
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
  /** Anchor id, derived from the same source as the rendering component's generated id (headingId). */
  id: string;
  text: string;
  depth: 2 | 3;
}

/** Heading text → anchor id. Strips inline markers then hyphenates on whitespace; preserves CJK text (natively supported by browsers). */
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
  // path format: './zh/start/introduction.md'
  const segments = /^\.\/(zh|en)\/([a-z-]+)\/([a-z0-9-]+)\.md$/.exec(path);
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
  /** Language source of truth title (md frontmatter), not via DictKey. */
  title: string;
}

/** Sidebar index: group order per DOC_GROUP_ORDER, within-group by slug lexicographic order. */
export function getDocsIndex(lang: DocsLang): DocsIndexEntry[] {
  return DOC_GROUP_ORDER.flatMap((group) =>
    [...pages.entries()]
      .filter(([key, meta]) => key.startsWith(`${lang}/`) && meta.group === group)
      .map(([, meta]) => meta)
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map((meta) => ({ slug: meta.slug, group: meta.group, title: meta.title }))
  );
}

/** Extract h2/h3 TOC from md source; id derived from same source as rendering component's headingId. */
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
