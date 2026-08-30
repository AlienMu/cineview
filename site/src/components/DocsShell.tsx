import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { LangToggle } from './LangToggle';
import {
  DOC_GROUP_ORDER,
  getDocHeadings,
  getDocsIndex,
  getDocsPage,
  type DocsGroupId,
  type DocsLang,
} from '../content/docs/manifest';

/**
 * 文档站顶部应用栏：产品标识 + 版本 + 分组导航 + ⌘K 搜索 + 语言切换。
 *
 * 版本号：`site/` 与框架根是两个 package，`import ../../package.json` 需要
 * `resolveJsonModule` 且会把整个 json 打进 bundle。这里写常量并在此注明同步来源，
 * 代价是发版时要手改一处 —— 比引入构建配置更小。
 * 来源：框架根 package.json 的 "version"。
 */
const FRAMEWORK_VERSION = 'v1.0';

interface SearchHit {
  slug: string;
  title: string;
  group: DocsGroupId;
  /** 命中的是页标题还是页内小节标题；后者带锚点。 */
  heading?: string;
  anchor?: string;
}

/**
 * 纯前端搜索：只索引页标题 + 页内 h2/h3 文本。
 * 40×2 页的标题集足够小，不值得引入全文索引依赖；子串匹配已能覆盖
 * 「我记得有个叫 xxx 的小节」这类真实用法。
 */
function useDocsSearch(lang: DocsLang): (query: string) => SearchHit[] {
  const index = useMemo(() => {
    const hits: SearchHit[] = [];
    for (const entry of getDocsIndex(lang)) {
      hits.push({ slug: entry.slug, title: entry.title, group: entry.group });
      const page = getDocsPage(entry.slug, lang);
      if (!page) continue;
      for (const heading of getDocHeadings(page.markdown)) {
        hits.push({
          slug: entry.slug,
          title: entry.title,
          group: entry.group,
          heading: heading.text,
          anchor: heading.id,
        });
      }
    }
    return hits;
  }, [lang]);

  return useCallback(
    (query: string): SearchHit[] => {
      const needle = query.trim().toLowerCase();
      if (!needle) return [];
      const scored = index
        .map((hit) => {
          const haystack = `${hit.title} ${hit.heading ?? ''}`.toLowerCase();
          const at = haystack.indexOf(needle);
          if (at < 0) return null;
          // 页标题命中优于小节命中；靠前命中优于靠后。
          return { hit, score: at + (hit.heading ? 40 : 0) };
        })
        .filter((row): row is { hit: SearchHit; score: number } => row !== null)
        .sort((a, b) => a.score - b.score);
      return scored.slice(0, 12).map((row) => row.hit);
    },
    [index]
  );
}

export function DocsShell({ activeSlug }: { activeSlug: string }): JSX.Element {
  const { lang, t } = useI18n();
  const docsLang: DocsLang = lang === 'zh' ? 'zh' : 'en';
  const navigate = useNavigate();
  const search = useDocsSearch(docsLang);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const results = useMemo(() => (open ? search(query) : []), [open, query, search]);

  // ⌘K / Ctrl+K 唤起，Esc 关闭。绑在 window 上，捕获阶段之外即可 —— 文档页没有
  // 其他 ⌘K 消费者。
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      // 面板刚挂载，focus 要等一帧。
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const go = useCallback(
    (hit: SearchHit): void => {
      setOpen(false);
      navigate(`/docs/${hit.slug}${hit.anchor ? `#${hit.anchor}` : ''}`);
      if (hit.anchor) {
        // 路由切换后 DOM 才存在，下一帧再对齐锚点。
        requestAnimationFrame(() => {
          document.getElementById(hit.anchor as string)?.scrollIntoView({ block: 'start' });
        });
      }
    },
    [navigate]
  );

  const onInputKey = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((c) => Math.min(c + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (event.key === 'Enter' && results[cursor]) {
      event.preventDefault();
      go(results[cursor]);
    }
  };

  const index = getDocsIndex(docsLang);
  const activeGroup = index.find((entry) => entry.slug === activeSlug)?.group;

  return (
    <>
      <header className="docs-shell">
        <div className="docs-shell__inner">
          <Link to="/" className="docs-shell__brand">
            <svg
              className="docs-shell__mark"
              viewBox="0 0 64 64"
              width="26"
              height="26"
              shapeRendering="crispEdges"
              aria-hidden="true"
            >
              <rect width="64" height="64" fill="#1f1d1a" />
              <path d="M18 17h28v8H26v14h20v8H18z" fill="#f8f5f0" />
              <path d="M26 25h20v8H26z" fill="#b86443" />
            </svg>
            CineView
            <span className="docs-shell__version mono">{FRAMEWORK_VERSION}</span>
          </Link>

          <nav className="docs-shell__nav" aria-label={t('docs.title')}>
            {DOC_GROUP_ORDER.map((group) => {
              const first = index.find((entry) => entry.group === group);
              if (!first) return null;
              return (
                <Link
                  key={group}
                  to={`/docs/${first.slug}`}
                  className={`docs-shell__navlink${group === activeGroup ? ' is-active' : ''}`}
                >
                  {t(`docs.group.${group}` as never)}
                </Link>
              );
            })}
          </nav>

          <div className="docs-shell__actions">
            <button
              type="button"
              className="docs-shell__search"
              onClick={() => setOpen(true)}
              aria-label={t('docs.search')}
            >
              <span>{t('docs.search')}</span>
              <kbd className="mono">⌘K</kbd>
            </button>
            <LangToggle variant="shell" />
          </div>
        </div>
      </header>

      {open && (
        <div
          className="docs-search"
          role="dialog"
          aria-modal="true"
          aria-label={t('docs.search')}
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="docs-search__panel">
            <input
              ref={inputRef}
              className="docs-search__input"
              value={query}
              placeholder={t('docs.search')}
              onChange={(event) => {
                setQuery(event.target.value);
                setCursor(0);
              }}
              onKeyDown={onInputKey}
            />
            {results.length > 0 && (
              <ul className="docs-search__results">
                {results.map((hit, i) => (
                  <li key={`${hit.slug}-${hit.anchor ?? 'page'}-${i}`}>
                    <button
                      type="button"
                      className={`docs-search__hit${i === cursor ? ' is-active' : ''}`}
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => go(hit)}
                    >
                      <span className="docs-search__hit-title">{hit.heading ?? hit.title}</span>
                      <span className="docs-search__hit-path mono">
                        {hit.heading ? hit.title : t(`docs.group.${hit.group}` as never)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** 文章底部翻页器。顺序取侧栏扁平序（组序 × 组内 slug 序）。 */
export function DocsPager({ activeSlug }: { activeSlug: string }): JSX.Element | null {
  const { lang, t } = useI18n();
  const docsLang: DocsLang = lang === 'zh' ? 'zh' : 'en';
  const index = getDocsIndex(docsLang);
  const at = index.findIndex((entry) => entry.slug === activeSlug);
  if (at < 0) return null;
  const prev = at > 0 ? index[at - 1] : null;
  const next = at < index.length - 1 ? index[at + 1] : null;
  if (!prev && !next) return null;

  return (
    <nav className="docs-pager" aria-label={`${t('docs.prev')} / ${t('docs.next')}`}>
      {prev ? (
        <Link to={`/docs/${prev.slug}`} className="docs-pager__link docs-pager__link--prev">
          <span className="docs-pager__label mono">← {t('docs.prev')}</span>
          <span className="docs-pager__title">{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link to={`/docs/${next.slug}`} className="docs-pager__link docs-pager__link--next">
          <span className="docs-pager__label mono">{t('docs.next')} →</span>
          <span className="docs-pager__title">{next.title}</span>
        </Link>
      )}
    </nav>
  );
}
