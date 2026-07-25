import { Link, NavLink, useParams } from 'react-router-dom';
import { useI18n, type DictKey } from '../i18n';

type DocSection = {
  heading: string;
  body: string;
  code?: string;
};

type DocItem = {
  slug: string;
  titleKey: DictKey;
  groupKey: DictKey;
  eyebrow: string;
  intro: string;
  sections: DocSection[];
};

const DOCS: DocItem[] = [
  {
    slug: 'introduction',
    titleKey: 'docs.page.introduction',
    groupKey: 'docs.group.start',
    eyebrow: 'START HERE',
    intro:
      'CineView is a React scene runtime for authored drag and real-document scroll experiences.',
    sections: [
      {
        heading: 'The mental model',
        body: 'CineView owns scene transitions and timeline ownership. Scene owns chapter layout. Animate consumes the active mode timeline. Ordinary React content can sit between scroll takeover scenes.',
      },
      {
        heading: 'A small scene',
        body: 'Start with one root, one mode, and an explicit design width. Add Scene only where chapter-level behavior is needed.',
        code: `<CineView config={{ size: 750 }} mode="drag">
  <Scene sceneId="hero">
    <Animate enterAnimation="fade-in">
      <h1>Opening frame</h1>
    </Animate>
  </Scene>
</CineView>`,
      },
    ],
  },
  {
    slug: 'installation',
    titleKey: 'docs.page.installation',
    groupKey: 'docs.group.start',
    eyebrow: 'INSTALL',
    intro: 'Install CineView alongside React and Framer Motion.',
    sections: [
      {
        heading: 'Package install',
        body: 'CineView declares React and Framer Motion as peer dependencies. Keep one copy of each runtime in the application bundle.',
        code: `pnpm add cineview framer-motion
# React 18 or React 19`,
      },
      {
        heading: 'Import the public surface',
        body: 'The root package exports the components, public ref types, and the zero-render timeline hook.',
        code: `import {
  Animate,
  CineView,
  Container,
  Image,
  Position,
  Scene,
  useAnimateTimeline,
} from 'cineview';`,
      },
    ],
  },
  {
    slug: 'quickstart',
    titleKey: 'docs.page.quickstart',
    groupKey: 'docs.group.start',
    eyebrow: 'QUICK START',
    intro: 'A complete drag scene with responsive px2vw layout and a delayed child animation.',
    sections: [
      {
        heading: 'Author a scene',
        body: 'Coordinates and box lengths use the design width as their single ruler. The framework owns the conversion; authoring stays in design pixels.',
        code: `<CineView config={{ size: 1440 }} mode="drag">
  <Scene
    sceneId="hero"
    layout={{ width: '100%', height: '100vh', anchor: 'center' }}
    transition={{ enterAnimation: 'fade-in', exitAnimation: 'fade-out' }}
  >
    <Position at={{ x: 120, y: 180 }}>
      <Animate
        animateId="title"
        enterAnimation="slide-up"
        timeline={{ delay: 120 }}
      >
        <h1>Build the frame</h1>
      </Animate>
    </Position>
  </Scene>
</CineView>`,
      },
    ],
  },
  {
    slug: 'responsive',
    titleKey: 'docs.page.responsive',
    groupKey: 'docs.group.concepts',
    eyebrow: 'ONE RULER',
    intro:
      'CineView scales lengths from the design width. It does not infer a second height scale.',
    sections: [
      {
        heading: 'Design-width conversion',
        body: 'Set config.size to the width of the design file. Position coordinates and Container box lengths are converted against the current viewport width. Percentages, auto, and CSS functions retain their authored meaning.',
        code: `<CineView config={{ size: 750 }}>
  <Scene>
    <Position at={{ x: 96, y: 160 }}>
      <Container width={420} height={240} />
    </Position>
  </Scene>
</CineView>`,
      },
    ],
  },
  {
    slug: 'modes',
    titleKey: 'docs.page.modes',
    groupKey: 'docs.group.concepts',
    eyebrow: 'TWO ENGINES',
    intro:
      'Drag is a scene stack. Scroll is native document flow with optional center-lock takeover zones.',
    sections: [
      {
        heading: 'Drag',
        body: 'Drag uses a render lane for scene travel and a scene-owned element lane for authored enter timing. Adjacent scenes remain mounted during a gesture.',
        code: `<CineView mode="drag" config={{ size: 750 }}>
  <Scene sceneId="chapter-01">...</Scene>
  <Scene sceneId="chapter-02">...</Scene>
</CineView>`,
      },
      {
        heading: 'Scroll',
        body: 'Scroll preserves native document distance. A Scene.scroll zone consumes only its declared timeline segment and releases the document at 0 or 100 percent.',
        code: `<CineView mode="scroll" config={{ size: 1440 }}>
  <article>Normal document content.</article>
  <Scene
    sceneId="sequence"
    scroll={{ zoneId: 'sequence', trigger: 'center-lock' }}
  >
    ...
  </Scene>
</CineView>`,
      },
    ],
  },
  {
    slug: 'timeline',
    titleKey: 'docs.page.timeline',
    groupKey: 'docs.group.concepts',
    eyebrow: 'OWNERSHIP',
    intro:
      'Every timeline input has one owner. Consumers read MotionValues; they do not write progress.',
    sections: [
      {
        heading: 'Zero-render consumer',
        body: 'Use the hook inside an Animate child for canvas, video, WebGL, or any consumer that should react to a MotionValue without a React render per frame.',
        code: `function CanvasLayer() {
  const timeline = useAnimateTimeline();
  useMotionValueEvent(timeline.progress, 'change', drawFrame);
  return <canvas />;
}

<Animate enterAnimation="fade-in">
  <CanvasLayer />
</Animate>`,
      },
      {
        heading: 'Read-only contract',
        body: 'progress is 0..1, signedProgress retains exit direction, and phase is the shared five-state phase vocabulary. The returned object has no setters.',
      },
    ],
  },
  {
    slug: 'cineview',
    titleKey: 'docs.page.cineview',
    groupKey: 'docs.group.components',
    eyebrow: 'ROOT',
    intro:
      'CineView selects the mode engine, provides the design-width context, schedules preload, and exposes imperative navigation.',
    sections: [
      {
        heading: 'Ref API',
        body: 'The common methods are always available. goToZone is scroll-only and is required by CineViewScrollRef.',
        code: `const ref = useRef<CineViewScrollRef>(null);

ref.current?.goToScene(2, true);
ref.current?.goToZone('sequence', { animated: true });
ref.current?.refreshLayout();
ref.current?.preload(['hero']);`,
      },
    ],
  },
  {
    slug: 'scene',
    titleKey: 'docs.page.scene',
    groupKey: 'docs.group.components',
    eyebrow: 'CHAPTER',
    intro:
      'Scene is the chapter boundary for layout, assets, visibility callbacks, and scene-scoped fixed layers.',
    sections: [
      {
        heading: 'Scroll zone',
        body: 'A scroll zone declares timeline ownership. It does not declare animation style or a virtual coordinate system.',
        code: `<Scene
  sceneId="hero-sequence"
  layout={{ width: '100%', height: '100vh', overflow: 'hidden' }}
  scroll={{ zoneId: 'hero-sequence', trigger: 'center-lock' }}
>
  <Position layer={{ fixed: true }}>...</Position>
</Scene>`,
      },
    ],
  },
  {
    slug: 'animate',
    titleKey: 'docs.page.animate',
    groupKey: 'docs.group.components',
    eyebrow: 'TIMELINE CONSUMER',
    intro:
      'Animate consumes the current mode semantics and composes delay, waitFor, phase, visibility, and stagger.',
    sections: [
      {
        heading: 'Current timeline API',
        body: 'sceneControlled defaults to true. Inside a scroll takeover zone it binds to the zone; elsewhere it gracefully falls back to visibility. Set false to force visibility.',
        code: `<Animate
  animateId="subtitle"
  enterAnimation="slide-up"
  exitAnimation="fade-out"
  duration={{ enter: 800, exit: 400 }}
  timeline={{ delay: 160, waitFor: 'title' }}
  visibility={{ replayOnReenter: true }}
>
  <p>Chapter copy</p>
</Animate>`,
      },
    ],
  },
  {
    slug: 'position',
    titleKey: 'docs.page.position',
    groupKey: 'docs.group.components',
    eyebrow: 'COORDINATES',
    intro:
      'Position owns coordinates and scene-scoped fixed mounting. Container owns box dimensions.',
    sections: [
      {
        heading: 'Coordinates and fixed layers',
        body: 'Position coordinates are design pixels. A fixed layer is scoped to its Scene and never floats across chapters.',
        code: `<Position at={{ x: 100, y: 220, offsetX: 8 }}>
  <Container width={420} height={180}>...</Container>
</Position>

<Position at={{ x: 0, y: 0 }} layer={{ fixed: true }}>
  <Overlay />
</Position>`,
      },
    ],
  },
  {
    slug: 'image',
    titleKey: 'docs.page.image',
    groupKey: 'docs.group.components',
    eyebrow: 'MEDIA',
    intro: 'Image uses the CineView preload pipeline without blocking ordinary content visibility.',
    sections: [
      {
        heading: 'Priority media',
        body: 'Declare first-screen media on Scene.assets or Image priority. Later resources stay in the background queue.',
        code: `<Scene assets={{ preloadImages: ['/hero.webp'] }}>
  <Image src="/hero.webp" alt="Opening frame" priority />
</Scene>`,
      },
    ],
  },
  {
    slug: 'container',
    titleKey: 'docs.page.container',
    groupKey: 'docs.group.components',
    eyebrow: 'BOX MODEL',
    intro:
      'Container converts width, height, and supported style lengths with the same design-width ruler.',
    sections: [
      {
        heading: 'Size without a second ruler',
        body: 'Use Container for box dimensions. Do not use it as a coordinate owner; Position remains responsible for placement.',
        code: `<Container width={520} height={300} style={{ padding: 24 }}>
  <Card />
</Container>`,
      },
    ],
  },
  {
    slug: 'centerlock',
    titleKey: 'docs.page.centerlock',
    groupKey: 'docs.group.advanced',
    eyebrow: 'SCROLL OWNERSHIP',
    intro: 'center-lock is a real scroll segment, not a second virtual page coordinate system.',
    sections: [
      {
        heading: 'Input order',
        body: 'A large input is consumed in order: reach the anchor, consume the zone progress, then return leftover distance to native document flow. Reverse entry reuses the completed segment from 100 back to 0.',
      },
      {
        heading: 'Zone progress',
        body: 'onZoneProgress reports the changed zone snapshot without debounce and retains exact 0 and 1 boundaries.',
      },
    ],
  },
  {
    slug: 'preload',
    titleKey: 'docs.page.preload',
    groupKey: 'docs.group.advanced',
    eyebrow: 'COLD START',
    intro:
      'The first scene is gated by priority media completion; background scenes continue loading without blocking the page.',
    sections: [
      {
        heading: 'Preload contract',
        body: 'Priority completion fires once. Background loading is deduplicated by the shared media cache. Ref.preload can add targeted scene or zone assets later.',
      },
    ],
  },
  {
    slug: 'callbacks',
    titleKey: 'docs.page.callbacks',
    groupKey: 'docs.group.advanced',
    eyebrow: 'OBSERVABILITY',
    intro:
      'Callbacks are grouped by semantic timing: realtime samples, boundaries, lifecycle, and errors.',
    sections: [
      {
        heading: 'Boundary callbacks',
        body: 'onReady fires once per mounted root. onSceneWillChange fires before a valid transition. onSceneDidChange fires at render commit. onDragCommit and onDragCancel are mutually exclusive for one gesture.',
      },
      {
        heading: 'Realtime callbacks',
        body: 'onDragProgress and onZoneProgress are sampled at the owner boundary without trailing debounce, preserving terminal values.',
      },
    ],
  },
  {
    slug: 'performance',
    titleKey: 'docs.page.performance',
    groupKey: 'docs.group.advanced',
    eyebrow: 'FRAME BUDGET',
    intro:
      'Keep per-frame work on MotionValues and keep layout reads outside continuous scroll frames.',
    sections: [
      {
        heading: 'Authoring checklist',
        body: 'Use Animate for authored transforms, use useAnimateTimeline for custom renderers, avoid measuring layout in a progress callback, and profile concurrent multi-element scenes before release.',
      },
      {
        heading: 'Verification commands',
        body: 'The repository gates coverage, type safety, duplication, package consumption, build size, and browser profile budgets.',
        code: `pnpm verify
pnpm --dir site type-check
pnpm --dir site build
pnpm --dir examples/performance-test test`,
      },
    ],
  },
];

const GROUPS: DictKey[] = [
  'docs.group.start',
  'docs.group.concepts',
  'docs.group.components',
  'docs.group.animation',
  'docs.group.advanced',
];

export default function DocsPage(): JSX.Element {
  const { slug } = useParams<{ slug?: string }>();
  const { lang, t } = useI18n();
  const active = DOCS.find((doc) => doc.slug === slug) ?? DOCS[0];
  const copy =
    lang === 'zh'
      ? {
          lead: '可验证的场景引擎文档：从最小用法到时间轴所有权。',
          back: '返回首页',
          demo: '打开 Demo',
          toc: '本页内容',
          source: '查看源码',
          sourceUrl: 'https://github.com/cineview/cineview',
        }
      : {
          lead: 'A verifiable scene runtime, documented from first frame to timeline ownership.',
          back: 'Back home',
          demo: 'Open demo',
          toc: 'On this page',
          source: 'View source',
          sourceUrl: 'https://github.com/cineview/cineview',
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
            const items = DOCS.filter((doc) => doc.groupKey === groupKey);
            if (items.length === 0) return null;
            return (
              <section key={groupKey} className="docs-nav__group">
                <h2>{t(groupKey)}</h2>
                {items.map((doc) => (
                  <NavLink
                    key={doc.slug}
                    to={`/docs/${doc.slug}`}
                    className={({ isActive }) =>
                      `docs-nav__link${isActive || (!slug && doc.slug === 'introduction') ? ' is-active' : ''}`
                    }
                  >
                    <span className="docs-nav__index mono">
                      {String(DOCS.indexOf(doc) + 1).padStart(2, '0')}
                    </span>
                    {t(doc.titleKey)}
                  </NavLink>
                ))}
              </section>
            );
          })}
        </aside>

        <article className="docs-article">
          <div className="docs-article__meta mono">
            <span>{active.eyebrow}</span>
            <span>/{active.slug}</span>
          </div>
          <h2>{t(active.titleKey)}</h2>
          <p className="docs-article__intro">{active.intro}</p>

          <div className="docs-article__body">
            {active.sections.map((section, index) => (
              <section key={section.heading} className="docs-section" id={`section-${index + 1}`}>
                <p className="docs-section__number mono">{String(index + 1).padStart(2, '0')}</p>
                <div>
                  <h3>{section.heading}</h3>
                  <p>{section.body}</p>
                  {section.code ? (
                    <pre>
                      <code>{section.code}</code>
                    </pre>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        </article>

        <aside className="docs-toc" aria-label={copy.toc}>
          <p className="docs-toc__label mono">{copy.toc}</p>
          {active.sections.map((section, index) => (
            <a key={section.heading} href={`#section-${index + 1}`}>
              <span className="mono">{String(index + 1).padStart(2, '0')}</span>
              {section.heading}
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
