import { Children, cloneElement, createContext, isValidElement, useContext } from 'react';
import type { ReactNode } from 'react';
import { Link, Navigate, NavLink, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { useI18n, type DictKey } from '../i18n';
import { DocsPager, DocsShell } from '../components/DocsShell';
import {
  DOC_GROUP_ORDER,
  getDocHeadings,
  getDocsIndex,
  getDocsPage,
  headingId,
  type DocsGroupId,
  type DocsHeading,
} from '../content/docs/manifest';

/**
 * 组 id → i18n key。`Record<DocsGroupId, …>` 是穷尽的，新增组时漏改这里会直接
 * type-check 失败（这是好事：失败得早且明确）。
 */
const GROUP_KEY_BY_ID: Record<DocsGroupId, DictKey> = {
  'getting-started': 'docs.group.getting-started',
  concepts: 'docs.group.concepts',
  drag: 'docs.group.drag',
  scroll: 'docs.group.scroll',
  components: 'docs.group.components',
  advanced: 'docs.group.advanced',
};

/**
 * 侧栏渲染顺序。**从 DOC_GROUP_ORDER 派生**，不再手写第二份列表——原先这里是
 * 一个独立的 `DictKey[]`，与 manifest 的组序重复；裸数组没有穷尽性约束，新增组
 * 时漏改它不会报错，只会让该组的侧栏分区静默消失。派生后单一真源。
 */
const GROUPS: DictKey[] = DOC_GROUP_ORDER.map((group) => GROUP_KEY_BY_ID[group]);

/**
 * 旧 slug → 新 slug 重定向表（2026-08-27 IA 重整；2026-08-28 修正键为真实历史 slug）。
 *
 * 站内链接已全部改写并由契约测试守卫，此表只服务**站外**已存在的链接与书签：
 * 命中即 `Navigate replace`，不留一条 404。键以 git HEAD 中实际对外存在过的
 * 34 个扁平 slug（旧站 git ls-tree 可复核）为准；中间态的编号式 slug 从未公开，
 * 不进表。
 */
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

/** 代码块 chrome：从 <code class="language-x"> 提取语言做标签头（R1 设计感）。 */
function resolveCodeLanguage(children: ReactNode): string {
  const codeElement = Children.toArray(children).find(isValidElement);
  const className: unknown = isValidElement(codeElement)
    ? (codeElement.props as { className?: unknown }).className
    : null;
  if (typeof className !== 'string') return 'text';
  return /language-([\w-]+)/.exec(className)?.[1] ?? 'text';
}

/**
 * 窄屏「堆叠卡片」表格所需的列名注入。
 *
 * 为什么必须注入：窄屏把 table 拆成一行一卡后表头不再可见，若单元格只剩裸值，
 * 读者无法知道 `750` 是默认值还是类型。卡片模式用 `td::before` 显示列名，
 * 而 CSS 拿不到 thead 文本，只能由渲染期把列名写进 `data-label`。
 *
 * 实现走 react-markdown 的组件覆盖：`table` 抽出表头文本经 context 下发，
 * `tr` 给自己的 td 逐个 cloneElement 补 `data-label`。不覆盖 `td` —— data-*
 * 属性落在内建元素上即可，少一层组件。
 */
const TableHeadersContext = createContext<string[]>([]);

/** 从 table 的 children 里取 thead 第一行的 th 文本。 */
function extractHeaderLabels(children: ReactNode): string[] {
  for (const section of Children.toArray(children)) {
    if (!isValidElement(section) || section.type !== 'thead') continue;
    for (const row of Children.toArray(section.props.children)) {
      if (!isValidElement(row)) continue;
      return Children.toArray(row.props.children)
        .filter(isValidElement)
        .map((cell) =>
          childText((cell as React.ReactElement<{ children?: ReactNode }>).props.children)
        );
    }
  }
  return [];
}

/* react-markdown 的组件映射键必须是小写标签名，但 eslint react-hooks 规则要求
 * 调用 Hook 的函数首字母大写 —— 单独抽出具名组件再映射到 `tr` 键。 */
function TrRow({ children }: { children?: ReactNode }): JSX.Element {
  const labels = useContext(TableHeadersContext);
  const cells = Children.toArray(children);
  // 表头行本身不加标签（它就是标签的来源）。
  const isHeaderRow = cells.some((cell) => isValidElement(cell) && cell.type === 'th');
  if (isHeaderRow) return <tr>{children}</tr>;
  return (
    <tr>
      {cells.map((cell, index) =>
        isValidElement(cell)
          ? cloneElement(cell as React.ReactElement<{ 'data-label'?: string }>, {
              'data-label': labels[index] ?? '',
            })
          : cell
      )}
    </tr>
  );
}

const markdownComponents = {
  table: ({ children }: { children?: ReactNode }) => (
    <TableHeadersContext.Provider value={extractHeaderLabels(children)}>
      <table>{children}</table>
    </TableHeadersContext.Provider>
  ),
  tr: TrRow,
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 id={headingId(childText(children))}>{children}</h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 id={headingId(childText(children))}>{children}</h3>
  ),
  pre: ({ children }: { children?: ReactNode }) => (
    <div className="docs-code">
      <div className="docs-code__header mono">
        <span className="docs-code__dot" aria-hidden="true" />
        {resolveCodeLanguage(children)}
      </div>
      <pre>{children}</pre>
    </div>
  ),
} as const;

interface SidebarEntry {
  slug: string;
  groupKey: DictKey;
  title: string;
}

/** 默认着陆页；三处引用（默认 slug / 侧栏 active / 404 CTA）共用此常量。 */
const DEFAULT_SLUG = '01-introduction';

export default function DocsPage(): JSX.Element {
  const { slug } = useParams<{ slug?: string }>();
  const { lang, t } = useI18n();
  const docsLang = lang === 'zh' ? 'zh' : 'en';
  const resolvedSlug = slug ?? DEFAULT_SLUG;
  const mdPage = getDocsPage(resolvedSlug, docsLang);

  // 旧 slug 走重定向而不是 404。放在 mdPage 查询之后：只有当前 slug 查不到页面时
  // 才考虑重定向，避免新旧 slug 万一重名时抢掉正常页面。
  const legacyTarget = !mdPage ? LEGACY_SLUG_MAP[resolvedSlug] : undefined;

  const entries: SidebarEntry[] = getDocsIndex(docsLang).map((entry) => ({
    slug: entry.slug,
    groupKey: GROUP_KEY_BY_ID[entry.group],
    title: entry.title,
  }));

  const headings: DocsHeading[] = mdPage ? getDocHeadings(mdPage.markdown) : [];

  const copy =
    lang === 'zh'
      ? {
          back: '返回首页',
          source: '查看源码',
          sourceUrl: 'https://github.com/AlienMu/cineview',
          notFoundTitle: '没有这一页',
          notFoundBody: '该文档不存在或已更名。侧边栏可以从任意分组继续。',
          notFoundCta: '回到介绍页',
        }
      : {
          back: 'Back home',
          source: 'View source',
          sourceUrl: 'https://github.com/AlienMu/cineview',
          notFoundTitle: 'Page not found',
          notFoundBody:
            'This document does not exist or was renamed. The sidebar has every section.',
          notFoundCta: 'Back to the introduction',
        };

  // 旧 slug：整页不渲染，直接替换历史条目跳到新地址。
  if (legacyTarget) {
    return <Navigate to={`/docs/${legacyTarget}`} replace />;
  }

  const activeGroupKey = mdPage ? GROUP_KEY_BY_ID[mdPage.group] : null;

  return (
    <main className="docs-page">
      <DocsShell activeSlug={resolvedSlug} />

      {/* 页头从「eyebrow + 大标题 + 导语 + 返回按钮」（实测 287px，mobile 351px）
          压成单行面包屑：站点标识与分组导航已上移到应用栏，这里只需回答
          「我在哪一组的哪一页」。 */}
      <nav className="docs-crumbs" aria-label={t('docs.title')}>
        <Link to="/" className="docs-crumbs__link">
          {copy.back}
        </Link>
        <span className="docs-crumbs__sep" aria-hidden="true">
          /
        </span>
        {activeGroupKey && <span className="docs-crumbs__group">{t(activeGroupKey)}</span>}
        {mdPage && (
          <>
            <span className="docs-crumbs__sep" aria-hidden="true">
              /
            </span>
            <span className="docs-crumbs__current">{mdPage.title}</span>
          </>
        )}
        <span className="docs-crumbs__tip mono">{t('docs.editTip')}</span>
      </nav>

      <div className="docs-layout">
        <aside className="docs-nav" aria-label={t('docs.title')}>
          {GROUPS.map((groupKey) => {
            const items = entries.filter((entry) => entry.groupKey === groupKey);
            if (items.length === 0) return null;
            return (
              <section key={groupKey} className="docs-nav__group">
                <h2>{t(groupKey)}</h2>
                {items.map((entry, indexInGroup) => (
                  <NavLink
                    key={entry.slug}
                    to={`/docs/${entry.slug}`}
                    className={({ isActive }) =>
                      `docs-nav__link${isActive || (!slug && entry.slug === DEFAULT_SLUG) ? ' is-active' : ''}`
                    }
                  >
                    {/* 组内序号，不是全局序号。原先用 entries.indexOf(entry)+1 取
                        全局扁平序，与文件名里的 01-/02- 无关：插入一个新组会让后面
                        每一页的可见编号整体位移，出现「侧栏写 15、slug 写
                        01-cineview」的错位。改为组内序号后两者恒等。 */}
                    <span className="docs-nav__index mono">
                      {String(indexInGroup + 1).padStart(2, '0')}
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
              {/* 文章标题是本页唯一的 h1（应用栏的站点名是 Link，不占标题层级）。
                  原先这里是 h2，与正文自身的 h2 同级，层级错位。 */}
              <h1>{mdPage.title}</h1>
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
            </>
          ) : (
            // 未知 slug：显式 404 态而非空 article（审计 P1-1——空 article 让
            // 读者以为页面坏了；sidebar 仍可用作导航出口）
            <div className="docs-article__notfound">
              <p className="docs-article__meta mono">404 / {slug}</p>
              <h2>{copy.notFoundTitle}</h2>
              <p>{copy.notFoundBody}</p>
              <Link to={`/docs/${DEFAULT_SLUG}`} className="btn btn--primary">
                {copy.notFoundCta}
              </Link>
            </div>
          )}
        </article>

        <aside className="docs-toc" aria-label={t('docs.onThisPage')}>
          <p className="docs-toc__label mono">{t('docs.onThisPage')}</p>
          {headings.map((heading) => (
            <a
              key={heading.id}
              href={`#${heading.id}`}
              /* hash 默认导航只做「最小可见滚动」，标题落在视口任意处（R1 实测
                 top 散落 164–1385）——拦截后 scrollIntoView 对准标题顶，
                 scroll-margin-top: 32px 让落点恒定离顶 32px。 */
              onClick={(event) => {
                event.preventDefault();
                document
                  .getElementById(heading.id)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
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
