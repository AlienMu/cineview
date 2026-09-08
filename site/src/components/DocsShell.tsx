import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { version } from '../../../package.json';
import { useI18n, type DictKey } from '../i18n';
import { LangToggle } from './LangToggle';
import {
  DOC_GROUP_ORDER,
  getDocHeadings,
  getDocsIndex,
  getDocsPage,
  type DocsGroupId,
  type DocsLang,
} from '../content/docs/manifest';

interface SearchHit {
  slug: string;
  title: string;
  group: DocsGroupId;
  heading?: string;
  anchor?: string;
}

function useDocsSearch(lang: DocsLang): (query: string) => SearchHit[] {
  const index = useMemo(() => {
    const hits: SearchHit[] = [];
    for (const entry of getDocsIndex(lang)) {
      hits.push(entry);
      const page = getDocsPage(entry.slug, lang);
      if (!page) continue;
      for (const heading of getDocHeadings(page.markdown)) {
        hits.push({ ...entry, heading: heading.text, anchor: heading.id });
      }
    }
    return hits;
  }, [lang]);

  return useCallback(
    (query: string): SearchHit[] => {
      const needle = query.trim().toLowerCase();
      if (!needle) return [];
      return index
        .map((hit) => {
          const at = (hit.title + ' ' + (hit.heading ?? '')).toLowerCase().indexOf(needle);
          return at < 0 ? null : { hit, score: at + (hit.heading ? 40 : 0) };
        })
        .filter((row): row is { hit: SearchHit; score: number } => row !== null)
        .sort((a, b) => a.score - b.score)
        .slice(0, 12)
        .map((row) => row.hit);
    },
    [index]
  );
}

/** Scroll the index without changing the browser's sequential focus starting point. */
export function revealCurrentDoc(navigation: HTMLElement | null): void {
  const current = navigation?.querySelector<HTMLElement>('[aria-current="page"]');
  const scroller = navigation?.closest<HTMLElement>('.docs-nav') ?? navigation;
  if (!current || !scroller || !scroller.clientHeight) return;
  const item = current.getBoundingClientRect();
  const bounds = scroller.getBoundingClientRect();
  if (item.top < bounds.top) scroller.scrollTop += item.top - bounds.top;
  else if (item.bottom > bounds.bottom) scroller.scrollTop += item.bottom - bounds.bottom;
}

export function DocsNavigation({
  activeSlug,
  onNavigate,
}: {
  activeSlug: string;
  onNavigate?: () => void;
}): React.JSX.Element {
  const { lang, t } = useI18n();
  const index = getDocsIndex(lang);
  const navigationRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const navigation = navigationRef.current;
    if (!navigation) return;
    const update = (): void => revealCurrentDoc(navigation);
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(navigation);
    const scroller = navigation.closest<HTMLElement>('.docs-nav');
    if (scroller) observer?.observe(scroller);
    window.addEventListener('resize', update);
    return (): void => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [activeSlug, lang]);
  return (
    <nav
      ref={navigationRef}
      className="docs-navigation"
      aria-label={lang === 'zh' ? '文档导航' : 'Documentation navigation'}
    >
      {DOC_GROUP_ORDER.map((group) => (
        <section key={group} className="docs-nav__group">
          <h2>{t(('docs.group.' + group) as DictKey)}</h2>
          <ul>
            {index
              .filter((entry) => entry.group === group)
              .map((entry) => (
                <li key={entry.slug}>
                  <Link
                    to={'/docs/' + entry.slug}
                    className={'docs-nav__link' + (entry.slug === activeSlug ? ' is-active' : '')}
                    aria-current={entry.slug === activeSlug ? 'page' : undefined}
                    onClick={onNavigate}
                  >
                    {entry.title}
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}

export function DocsShell({
  onOpenNavigation,
}: {
  onOpenNavigation: () => void;
}): React.JSX.Element {
  const { lang, t } = useI18n();
  const navigate = useNavigate();
  const search = useDocsSearch(lang);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const results = useMemo(() => search(query), [query, search]);
  const zh = lang === 'zh';

  useEffect(() => {
    if (!dialogRef.current?.open) return;
    dialogRef.current
      .querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [cursor, results]);

  const openSearch = useCallback(() => {
    setQuery('');
    setCursor(0);
    dialogRef.current?.showModal();
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (dialogRef.current?.open) dialogRef.current.close();
        else openSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return (): void => window.removeEventListener('keydown', onKey);
  }, [openSearch]);

  const go = (hit: SearchHit): void => {
    dialogRef.current?.close();
    navigate('/docs/' + hit.slug + (hit.anchor ? '#' + encodeURIComponent(hit.anchor) : ''));
  };

  return (
    <>
      <a className="docs-skip" href="#docs-content">
        {zh ? '跳到正文' : 'Skip to content'}
      </a>
      <header className="docs-shell">
        <div className="docs-shell__inner">
          <button
            className="docs-icon-button docs-menu-button"
            type="button"
            onClick={onOpenNavigation}
            aria-label={zh ? '打开文档目录' : 'Open documentation menu'}
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M4 6h16M4 12h12M4 18h16" />
            </svg>
          </button>
          <Link
            to="/"
            className="docs-shell__brand"
            aria-label={zh ? 'CineView 首页' : 'CineView home'}
          >
            <span className="docs-shell__mark" aria-hidden="true">
              C
            </span>
            <span>CineView</span>
          </Link>
          <Link className="docs-shell__section" to="/docs">
            {t('docs.title')}
          </Link>
          <span className="docs-shell__version">v{version}</span>
          <div className="docs-shell__actions">
            <button
              type="button"
              className="docs-shell__search"
              onClick={openSearch}
              aria-label={zh ? '搜索文档' : 'Search documentation'}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m16 16 4.5 4.5" />
              </svg>
              <span>{zh ? '搜索文档' : 'Search documentation'}</span>
              <kbd>⌘ K</kbd>
            </button>
            <Link className="docs-shell__demo" to="/drag">
              {zh ? '体验演示' : 'View demo'}
              <span aria-hidden="true">↗</span>
            </Link>
            <LangToggle variant="shell" />
          </div>
        </div>
      </header>

      <dialog
        ref={dialogRef}
        className="docs-dialog docs-search"
        aria-labelledby="docs-search-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
      >
        <div className="docs-search__panel">
          <div className="docs-dialog__header">
            <h2 id="docs-search-title">{zh ? '搜索文档' : 'Search documentation'}</h2>
            <button
              type="button"
              className="docs-icon-button"
              onClick={() => dialogRef.current?.close()}
              aria-label={zh ? '关闭搜索' : 'Close search'}
            >
              ×
            </button>
          </div>
          <input
            ref={inputRef}
            className="docs-search__input"
            role="combobox"
            aria-label={zh ? '搜索关键词' : 'Search terms'}
            aria-autocomplete="list"
            aria-expanded={results.length > 0}
            aria-controls="docs-search-results"
            aria-activedescendant={results[cursor] ? 'docs-search-hit-' + cursor : undefined}
            autoComplete="off"
            placeholder={zh ? '组件、概念或设置…' : 'A component, concept, or setting…'}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                setCursor((value) =>
                  Math.max(
                    0,
                    Math.min(results.length - 1, value + (event.key === 'ArrowDown' ? 1 : -1))
                  )
                );
              } else if (event.key === 'Enter' && results[cursor]) {
                event.preventDefault();
                go(results[cursor]);
              }
            }}
          />
          <ul
            id="docs-search-results"
            className="docs-search__results"
            role="listbox"
            aria-label={zh ? '搜索结果' : 'Search results'}
          >
            {results.map((hit, index) => (
              <li
                key={hit.slug + '#' + (hit.anchor ?? '')}
                id={'docs-search-hit-' + index}
                role="option"
                aria-selected={cursor === index}
                className={'docs-search__hit' + (cursor === index ? ' is-active' : '')}
                onPointerMove={() => setCursor(index)}
                onClick={() => go(hit)}
              >
                <span className="docs-search__hit-title">{hit.heading ?? hit.title}</span>
                <span className="docs-search__hit-path">
                  {hit.heading ? hit.title : t(('docs.group.' + hit.group) as DictKey)}
                </span>
                <span className="docs-search__hit-arrow" aria-hidden="true">
                  ↗
                </span>
              </li>
            ))}
          </ul>
          {results.length === 0 && (
            <p className="docs-search__empty" role="status">
              {query.trim()
                ? zh
                  ? '没有找到匹配项，试试组件名或更短的关键词。'
                  : 'No matches. Try a component name or a shorter search.'
                : zh
                  ? '搜索页面标题和章节标题。'
                  : 'Search page titles and section headings.'}
            </p>
          )}
          <div className="docs-search__help">
            <span>↑ ↓ {zh ? '选择' : 'Move'}</span>
            <span>↵ {zh ? '打开' : 'Open'}</span>
            <span>Esc {zh ? '关闭' : 'Close'}</span>
          </div>
        </div>
      </dialog>
    </>
  );
}

export function DocsPager({ activeSlug }: { activeSlug: string }): React.JSX.Element | null {
  const { lang, t } = useI18n();
  const index = getDocsIndex(lang);
  const at = index.findIndex((entry) => entry.slug === activeSlug);
  if (at < 0) return null;
  const prev = index[at - 1];
  const next = index[at + 1];
  return (
    <nav className="docs-pager" aria-label={lang === 'zh' ? '相邻文档' : 'Adjacent pages'}>
      {prev ? (
        <Link to={'/docs/' + prev.slug} className="docs-pager__link">
          <span className="docs-pager__label">← {t('docs.prev')}</span>
          <span className="docs-pager__title">{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link to={'/docs/' + next.slug} className="docs-pager__link docs-pager__link--next">
          <span className="docs-pager__label">{t('docs.next')} →</span>
          <span className="docs-pager__title">{next.title}</span>
        </Link>
      )}
    </nav>
  );
}
