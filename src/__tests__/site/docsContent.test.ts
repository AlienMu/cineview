/**
 * Bilingual documentation content contract (Stage 3 T1.1, task-flow 2026-08-23-stage3-demo-hub-docs).
 *
 * Independent re-derivation from site/src/content/docs/manifest.ts (fs direct read, not via import.meta.glob
 * which doesn't exist in jest): zh/en directories must be isomorphic, frontmatter must declare title, paths must
 * fall within whitelisted groups. Adding a page on one side without mirroring it on the other immediately fails here.
 * Violations are collected as "file-path + description" strings and asserted in batch; failure message is the remediation checklist.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const DOCS_ROOT = join(__dirname, '../../../site/src/content/docs');
const VALID_GROUPS = new Set([
  'getting-started',
  'concepts',
  'drag',
  'scroll',
  'components',
  'advanced',
]);
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

function readFrontmatterField(source: string, field: string): string | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  if (!match) return null;
  const line = match[1].split(/\r?\n/).find((entry) => new RegExp(`^${field}:\\s*\\S`).test(entry));
  return line ? line.replace(new RegExp(`^${field}:\\s*`), '') : null;
}

function headingShape(source: string): string[] {
  return source
    .split(/\r?\n/)
    .map((line) => /^(##|###)\s+/.exec(line)?.[1])
    .filter((level): level is string => Boolean(level));
}

describe('docs bilingual content contract', () => {
  const perLang = new Map<string, string[]>(
    LANGS.map((lang) => [lang, collectMarkdownFiles(join(DOCS_ROOT, lang))])
  );

  it('keeps zh and en directory trees isomorphic', () => {
    const zh = new Set(perLang.get('zh'));
    const en = new Set(perLang.get('en'));
    const problems = [
      ...[...en].filter((file) => !zh.has(file)).map((file) => `en has, zh missing: ${file}`),
      ...[...zh].filter((file) => !en.has(file)).map((file) => `zh has, en missing: ${file}`),
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
          problems.push(`${lang}/${file}: path must be {group}/{slug}.md two-segment form`);
          continue;
        }
        if (!VALID_GROUPS.has(segments[0])) {
          problems.push(`${lang}/${file}: unknown group ${segments[0]}`);
        }
        if (!/^[a-z0-9-]+\.md$/.test(segments[1])) {
          problems.push(`${lang}/${file}: slug must be lowercase letters, digits, hyphens`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('generates unique heading anchor ids within every page', () => {
    // headingId is generated from heading text: duplicate h2/h3 titles on the same page
    // produce duplicate DOM ids, TOC second link always scrolls to the first occurrence
    // (R3 review B-1 #2 latent mechanism, one-line guard).
    const problems: string[] = [];
    for (const lang of LANGS) {
      for (const file of perLang.get(lang) ?? []) {
        const source = readFileSync(join(DOCS_ROOT, lang, file), 'utf8');
        const ids = new Map<string, number>();
        for (const line of source.split(/\r?\n/)) {
          const match = /^(##|###)\s+(.+)$/.exec(line);
          if (!match) continue;
          const id = match[2]
            .replace(/[`*_\]()[[]/g, '')
            .trim()
            .replace(/\s+/g, '-');
          ids.set(id, (ids.get(id) ?? 0) + 1);
        }
        for (const [id, count] of ids) {
          if (count > 1) problems.push(`${lang}/${file}: heading id "${id}" appears ×${count}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('keeps every slug globally unique across groups', () => {
    // Route is /docs/:slug, group is not in URL; manifest uses `${lang}/${slug}` as key.
    // Two different groups with the same slug will overwrite each other, with **no error** —
    // survivor is determined by import.meta.glob iteration order, the other page silently
    // disappears and may hang under the wrong sidebar group. This guard blocks that silent overwrite.
    const problems: string[] = [];
    for (const lang of LANGS) {
      const bySlug = new Map<string, string[]>();
      for (const file of perLang.get(lang) ?? []) {
        const [group, name] = file.split('/');
        const slug = name.replace(/\.md$/, '');
        bySlug.set(slug, [...(bySlug.get(slug) ?? []), group]);
      }
      for (const [slug, groups] of bySlug) {
        if (groups.length > 1) {
          problems.push(`${lang}: slug "${slug}" appears in multiple groups ${groups.join(', ')}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('resolves every internal /docs/<slug> link to an existing page', () => {
    // Migration/renaming silently produces dead links: route renders 404 state for unknown slugs,
    // both build and type-check succeed. N5's "link targets exist" is just a slogan without this assertion.
    const slugsByLang = new Map<string, Set<string>>(
      LANGS.map((lang) => [
        lang,
        new Set((perLang.get(lang) ?? []).map((file) => file.split('/')[1].replace(/\.md$/, ''))),
      ])
    );
    const problems: string[] = [];
    for (const lang of LANGS) {
      const known = slugsByLang.get(lang) ?? new Set<string>();
      for (const file of perLang.get(lang) ?? []) {
        const source = readFileSync(join(DOCS_ROOT, lang, file), 'utf8');
        for (const match of source.matchAll(/\]\(\/docs\/([a-z0-9-]+)\)/g)) {
          if (!known.has(match[1])) {
            problems.push(`${lang}/${file}: dead link /docs/${match[1]}`);
          }
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
          problems.push(`${lang}/${file}: frontmatter missing non-empty title`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('keeps frontmatter eyebrows aligned across languages', () => {
    const problems: string[] = [];
    for (const file of perLang.get('en') ?? []) {
      const enSource = readFileSync(join(DOCS_ROOT, 'en', file), 'utf8');
      const zhSource = readFileSync(join(DOCS_ROOT, 'zh', file), 'utf8');
      const enEyebrow = readFrontmatterField(enSource, 'eyebrow');
      const zhEyebrow = readFrontmatterField(zhSource, 'eyebrow');
      if (!enEyebrow || !zhEyebrow) {
        problems.push(`${file}: frontmatter missing non-empty eyebrow`);
      } else if (enEyebrow !== zhEyebrow) {
        problems.push(`${file}: zh/en eyebrow mismatch (${zhEyebrow} / ${enEyebrow})`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('keeps heading-level structure aligned across languages', () => {
    const problems: string[] = [];
    for (const file of perLang.get('en') ?? []) {
      const enShape = headingShape(readFileSync(join(DOCS_ROOT, 'en', file), 'utf8'));
      const zhShape = headingShape(readFileSync(join(DOCS_ROOT, 'zh', file), 'utf8'));
      if (enShape.join(',') !== zhShape.join(',')) {
        problems.push(
          `${file}: zh/en heading structure mismatch (${zhShape.join(',')} / ${enShape.join(',')})`
        );
      }
    }
    expect(problems).toEqual([]);
  });
});
