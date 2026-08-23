import { Children, isValidElement } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { useI18n, type DictKey } from '../i18n';
import {
  getDocHeadings,
  getDocsIndex,
  getDocsPage,
  headingId,
  type DocsGroupId,
  type DocsHeading,
} from '../content/docs/manifest';

const GROUPS: DictKey[] = [
  'docs.group.start',
  'docs.group.concepts',
  'docs.group.components',
  'docs.group.api',
  'docs.group.animation',
  'docs.group.advanced',
];

const GROUP_KEY_BY_ID: Record<DocsGroupId, DictKey> = {
  start: 'docs.group.start',
  concepts: 'docs.group.concepts',
  components: 'docs.group.components',
  api: 'docs.group.api',
  animation: 'docs.group.animation',
  advanced: 'docs.group.advanced',
};

/** react-markdown 的 children 不一定是纯文本，摊平成字符串再生成锚点 id。 */
function childText(children: ReactNode): string {
  return Children.toArray(children)
    .map((node): string => {
      if (typeof node === 'string' || typeof node === 'number') return String(node);
      if (isValidElement(node)) return childText(node.props.children);
      return '';
    })
    .join('');
}

const markdownComponents = {
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 id={headingId(childText(children))}>{children}</h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 id={headingId(childText(children))}>{children}</h3>
  ),
} as const;

interface SidebarEntry {
  slug: string;
  groupKey: DictKey;
  title: string;
}

export default function DocsPage(): JSX.Element {
  const { slug } = useParams<{ slug?: string }>();
  const { lang, t } = useI18n();
  const docsLang = lang === 'zh' ? 'zh' : 'en';
  const mdPage = getDocsPage(slug ?? 'introduction', docsLang);

  const entries: SidebarEntry[] = getDocsIndex(docsLang).map((entry) => ({
    slug: entry.slug,
    groupKey: GROUP_KEY_BY_ID[entry.group],
    title: entry.title,
  }));

  const headings: DocsHeading[] = mdPage ? getDocHeadings(mdPage.markdown) : [];

  const copy =
    lang === 'zh'
      ? {
          lead: '可验证的场景引擎文档：从最小用法到时间轴所有权。',
          back: '返回首页',
          demo: '打开 Demo',
          toc: '本页内容',
          source: '查看源码',
          sourceUrl: 'https://github.com/AlienMu/cineview',
          notFoundTitle: '没有这一页',
          notFoundBody: '该文档不存在或已更名。侧边栏可以从任意分组继续。',
          notFoundCta: '回到介绍页',
        }
      : {
          lead: 'A verifiable scene runtime, documented from first frame to timeline ownership.',
          back: 'Back home',
          demo: 'Open demo',
          toc: 'On this page',
          source: 'View source',
          sourceUrl: 'https://github.com/AlienMu/cineview',
          notFoundTitle: 'Page not found',
          notFoundBody:
            'This document does not exist or was renamed. The sidebar has every section.',
          notFoundCta: 'Back to the introduction',
        };

  return (
    <main className="docs-page">
      <header className="docs-page__header">
        <div>
          <p className="eyebrow mono">CINEVIEW / DOCS</p>
          <h1>{t('docs.title')}</h1>
          <p className="docs-page__lead">{copy.lead}</p>
        </div>
        <div className="docs-page__actions">
          <Link to="/" className="btn btn--ghost">
            {copy.back}
          </Link>
          <Link to="/demo" className="btn btn--primary">
            {copy.demo}
          </Link>
        </div>
      </header>

      <div className="docs-layout">
        <aside className="docs-nav" aria-label={t('docs.title')}>
          {GROUPS.map((groupKey) => {
            const items = entries.filter((entry) => entry.groupKey === groupKey);
            if (items.length === 0) return null;
            return (
              <section key={groupKey} className="docs-nav__group">
                <h2>{t(groupKey)}</h2>
                {items.map((entry) => (
                  <NavLink
                    key={entry.slug}
                    to={`/docs/${entry.slug}`}
                    className={({ isActive }) =>
                      `docs-nav__link${isActive || (!slug && entry.slug === 'introduction') ? ' is-active' : ''}`
                    }
                  >
                    <span className="docs-nav__index mono">
                      {String(entries.indexOf(entry) + 1).padStart(2, '0')}
                    </span>
                    {entry.title}
                  </NavLink>
                ))}
              </section>
            );
          })}
        </aside>

        <article className="docs-article">
          {mdPage ? (
            <>
              <div className="docs-article__meta mono">
                <span>{mdPage.eyebrow}</span>
                <span>/{mdPage.slug}</span>
              </div>
              <h2>{mdPage.title}</h2>
              <div className="docs-article__markdown">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={markdownComponents}
                >
                  {mdPage.markdown}
                </ReactMarkdown>
              </div>
            </>
          ) : (
            // 未知 slug：显式 404 态而非空 article（审计 P1-1——空 article 让
            // 读者以为页面坏了；sidebar 仍可用作导航出口）
            <div className="docs-article__notfound">
              <p className="docs-article__meta mono">404 / {slug}</p>
              <h2>{copy.notFoundTitle}</h2>
              <p>{copy.notFoundBody}</p>
              <Link to="/docs/introduction" className="btn btn--primary">
                {copy.notFoundCta}
              </Link>
            </div>
          )}
        </article>

        <aside className="docs-toc" aria-label={copy.toc}>
          <p className="docs-toc__label mono">{copy.toc}</p>
          {headings.map((heading) => (
            <a key={heading.id} href={`#${heading.id}`}>
              <span className="mono">{String(headings.indexOf(heading) + 1).padStart(2, '0')}</span>
              {heading.text}
            </a>
          ))}
          <a className="docs-toc__source" href={copy.sourceUrl} target="_blank" rel="noreferrer">
            {copy.source}
          </a>
        </aside>
      </div>
    </main>
  );
}
