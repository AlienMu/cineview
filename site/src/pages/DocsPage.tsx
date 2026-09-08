import { Children, isValidElement, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { useI18n, type DictKey } from '../i18n';
import { DocsNavigation, DocsPager, DocsShell, revealCurrentDoc } from '../components/DocsShell';
import { getDocHeadings, getDocsPage, headingId } from '../content/docs/manifest';
import '../styles/Docs.css';

const LEGACY_SLUG_MAP: Record<string, string> = {
  // start → getting-started
  introduction: '01-introduction',
  installation: '02-installation',
  quickstart: '03-quickstart',
  // concepts
  modes: '01-modes',
  timeline: '02-timeline',
  responsive: '05-responsive',
  'dual-track': '03-two-track',
  'fixed-layer': '04-fixed-layer',
  // components（组件页与同名 api 页合并，指向组件页）
  cineview: '01-cineview',
  'cineview-api': '01-cineview',
  scene: '02-scene',
  'scene-api': '02-scene',
  animate: '03-animate',
  'animate-api': '03-animate',
  'animate-video': '04-animate-video',
  'animate-video-api': '04-animate-video',
  position: '05-position',
  'position-api': '05-position',
  image: '06-image',
  'image-api': '06-image',
  container: '07-container',
  'container-api': '07-container',
  // api 组专属
  types: '10-types',
  'use-animate-timeline-api': '09-use-animate-timeline',
  // animation 组
  presets: '08-presets',
  custom: '05-custom-animation',
  'waitfor-stagger': '04-orchestration',
  // advanced 组
  performance: '01-performance',
  preload: '02-preload',
  callbacks: '03-callbacks',
  'direction-x': '04-direction-x',
  centerlock: '01-centerlock',
  'scrollbar-theming': '05-scrollbar',
  // 2026-08-27 去比喻化：页面标题从「可见性闸门」改为「可见性条件」，slug 随之对齐。
  '03-visibility-gate': '03-visibility-conditions',
};

function childText(children: ReactNode): string {
  return Children.toArray(children)
    .map((node): string => {
      if (typeof node === 'string' || typeof node === 'number') return String(node);
      return isValidElement(node)
        ? childText((node.props as { children?: ReactNode }).children)
        : '';
    })
    .join('');
}

function CodeBlock({ children }: { children?: ReactNode }): React.JSX.Element {
  const { lang } = useI18n();
  const [status, setStatus] = useState<'ready' | 'copied' | 'error'>('ready');
  const codeElement = Children.toArray(children).find(isValidElement);
  const className = isValidElement(codeElement)
    ? ((codeElement.props as { className?: string }).className ?? '')
    : '';
  const language = /language-([\w-]+)/.exec(className)?.[1] ?? 'text';
  const zh = lang === 'zh';
  useEffect(() => {
    if (status === 'ready') return;
    const timer = window.setTimeout(() => setStatus('ready'), 2000);
    return (): void => window.clearTimeout(timer);
  }, [status]);

  return (
    <div className="docs-code">
      <div className="docs-code__header">
        <span>{language}</span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(childText(children));
              setStatus('copied');
            } catch {
              setStatus('error');
            }
          }}
          aria-label={zh ? '复制代码' : 'Copy code'}
        >
          {status === 'copied'
            ? zh
              ? '已复制'
              : 'Copied'
            : status === 'error'
              ? zh
                ? '复制失败'
                : 'Copy failed'
              : zh
                ? '复制'
                : 'Copy'}
        </button>
      </div>
      <pre tabIndex={0} aria-label={zh ? '代码示例' : 'Code example'}>
        {children}
      </pre>
      <span className="docs-sr-only" role="status">
        {status === 'copied'
          ? zh
            ? '代码已复制'
            : 'Code copied'
          : status === 'error'
            ? zh
              ? '请选中代码后手动复制。'
              : 'Select the code to copy it manually.'
            : ''}
      </span>
    </div>
  );
}

function MarkdownTable({ children }: { children?: ReactNode }): React.JSX.Element {
  const { lang } = useI18n();
  return (
    <div
      className="docs-table"
      role="region"
      aria-label={lang === 'zh' ? '数据表格，可横向滚动' : 'Data table, scroll horizontally'}
      tabIndex={0}
    >
      <table>{children}</table>
    </div>
  );
}

function Heading({
  level,
  children,
}: {
  level: 'h2' | 'h3';
  children?: ReactNode;
}): React.JSX.Element {
  const title = childText(children);
  const id = headingId(title);
  const Tag = level;
  return (
    <Tag id={id}>
      <a className="docs-heading-link" href={'#' + encodeURIComponent(id)}>
        {children}
      </a>
    </Tag>
  );
}

const markdownComponents = {
  table: MarkdownTable,
  h2: ({ children }: { children?: ReactNode }) => <Heading level="h2">{children}</Heading>,
  h3: ({ children }: { children?: ReactNode }) => <Heading level="h3">{children}</Heading>,
  pre: CodeBlock,
} as const;

const DEFAULT_SLUG = '01-introduction';

export default function DocsPage(): React.JSX.Element {
  const { slug } = useParams<{ slug?: string }>();
  const { hash, pathname, search } = useLocation();
  const navigate = useNavigate();
  const { lang, t } = useI18n();
  const zh = lang === 'zh';
  const resolvedSlug = slug ?? DEFAULT_SLUG;
  const mdPage = getDocsPage(resolvedSlug, lang);
  const legacyTarget = !mdPage ? LEGACY_SLUG_MAP[resolvedSlug] : undefined;
  const headings = useMemo(() => (mdPage ? getDocHeadings(mdPage.markdown) : []), [mdPage]);
  const navigationDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!hash) return;
    let id = hash.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch {
      return;
    }
    if (headings.some((heading) => heading.id === id)) return;
    const translatedPage = getDocsPage(resolvedSlug, zh ? 'en' : 'zh');
    if (!translatedPage) return;
    const index = getDocHeadings(translatedPage.markdown).findIndex((heading) => heading.id === id);
    const translated = headings[index];
    if (translated) {
      navigate(
        { pathname, search, hash: '#' + encodeURIComponent(translated.id) },
        { replace: true }
      );
    }
  }, [hash, headings, navigate, pathname, resolvedSlug, search, zh]);

  useEffect(() => {
    const previous = document.title;
    document.title =
      (mdPage?.title ?? (zh ? '没有找到这一页' : 'Page not found')) + ' · CineView Docs';
    return (): void => {
      document.title = previous;
    };
  }, [mdPage, zh]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (hash) {
        let id = hash.slice(1);
        try {
          id = decodeURIComponent(id);
        } catch {
          /* Keep malformed external fragments harmless. */
        }
        document.getElementById(id)?.scrollIntoView({ block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    });
    return (): void => cancelAnimationFrame(frame);
  }, [resolvedSlug, hash]);

  if (legacyTarget) return <Navigate to={'/docs/' + legacyTarget + hash} replace />;

  const toc = (
    <nav aria-label={t('docs.onThisPage')} className="docs-toc__links">
      {headings.map((heading) => (
        <a
          key={heading.id}
          href={'#' + encodeURIComponent(heading.id)}
          className={heading.depth === 3 ? 'docs-toc__nested' : undefined}
          onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')}
        >
          {heading.text}
        </a>
      ))}
    </nav>
  );

  return (
    <main className="docs-page" data-lang={lang}>
      <DocsShell
        onOpenNavigation={() => {
          navigationDialog.current?.showModal();
          revealCurrentDoc(
            navigationDialog.current?.querySelector<HTMLElement>('.docs-navigation') ?? null
          );
        }}
      />
      <div className="docs-layout">
        <aside className="docs-nav">
          <div className="docs-nav__intro">
            <span>{zh ? '使用指南' : 'The guide'}</span>
            <p>{zh ? '从第一个场景，到完整页面。' : 'From a first scene to a complete page.'}</p>
          </div>
          <DocsNavigation activeSlug={resolvedSlug} />
          <a
            className="docs-nav__source"
            href="https://github.com/AlienMu/cineview"
            target="_blank"
            rel="noreferrer"
          >
            {zh ? 'GitHub 源码' : 'Source on GitHub'} <span aria-hidden="true">↗</span>
          </a>
        </aside>

        <article className="docs-article" id="docs-content" tabIndex={-1}>
          {mdPage ? (
            <>
              <nav className="docs-crumbs" aria-label={zh ? '当前位置' : 'Breadcrumb'}>
                <Link to="/docs">{t('docs.title')}</Link>
                <span aria-hidden="true">/</span>
                <span>{t(('docs.group.' + mdPage.group) as DictKey)}</span>
              </nav>
              <header className="docs-article__header">
                <p className="docs-article__eyebrow">
                  {t(('docs.group.' + mdPage.group) as DictKey)}
                </p>
                <h1>{mdPage.title}</h1>
              </header>
              {headings.length > 0 && (
                <details className="docs-toc-mobile" key={resolvedSlug}>
                  <summary>
                    {t('docs.onThisPage')}
                    <span aria-hidden="true">+</span>
                  </summary>
                  {toc}
                </details>
              )}
              <div className="docs-article__markdown">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={markdownComponents}
                >
                  {mdPage.markdown}
                </ReactMarkdown>
              </div>
              <DocsPager activeSlug={resolvedSlug} />
              <footer className="docs-article__footer">
                <span>CineView / {t('docs.title')}</span>
                <a
                  href="https://github.com/AlienMu/cineview/issues"
                  target="_blank"
                  rel="noreferrer"
                >
                  {zh ? '反馈文档问题' : 'Report a documentation issue'} ↗
                </a>
              </footer>
            </>
          ) : (
            <div className="docs-article__notfound">
              <p className="docs-article__eyebrow">404</p>
              <h1>{zh ? '没有找到这一页' : 'Page not found'}</h1>
              <p>
                {zh
                  ? '这个地址没有对应的文档。可以从目录继续查找，或回到介绍页。'
                  : 'There is no document at this address. Browse the guide or return to the introduction.'}
              </p>
              <Link to={'/docs/' + DEFAULT_SLUG}>
                {zh ? '打开介绍页' : 'Open the introduction'} →
              </Link>
            </div>
          )}
        </article>

        <aside className="docs-toc">
          {headings.length > 0 && (
            <>
              <p className="docs-toc__label">{t('docs.onThisPage')}</p>
              {toc}
            </>
          )}
          <div className="docs-toc__end">
            <span aria-hidden="true" className="docs-toc__mark" />
            <p>{zh ? '在实际页面中查看效果。' : 'See the motion in a working page.'}</p>
            <Link to="/">{zh ? '打开演示' : 'Open the demo'} ↗</Link>
          </div>
        </aside>
      </div>

      <dialog
        ref={navigationDialog}
        className="docs-dialog docs-menu"
        aria-labelledby="docs-menu-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) navigationDialog.current?.close();
        }}
      >
        <div className="docs-menu__panel">
          <div className="docs-dialog__header">
            <h2 id="docs-menu-title">{zh ? '文档目录' : 'Documentation'}</h2>
            <button
              className="docs-icon-button"
              type="button"
              aria-label={zh ? '关闭目录' : 'Close documentation menu'}
              onClick={() => navigationDialog.current?.close()}
            >
              ×
            </button>
          </div>
          <DocsNavigation
            activeSlug={resolvedSlug}
            onNavigate={() => navigationDialog.current?.close()}
          />
        </div>
      </dialog>
    </main>
  );
}
