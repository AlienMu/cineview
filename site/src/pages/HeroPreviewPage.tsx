import { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Animate, Cineview, Scene, useAnimateTimeline } from 'cineview';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { useI18n } from '../i18n';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import './HeroPreviewPage.css';

const COPY = {
  zh: {
    nav: '主导航',
    examples: '案例',
    guide: '设计思路',
    docs: '文档',
    description: '制作随滚动与拖动变化的页面。',
    start: '从想法开始',
    view: '看案例',
    language: '页面语言',
    brief: '给 AI 的页面说明',
    idea: '描述你的页面想法',
    placeholder: '我有三张图，想做一页作品介绍。',
    copy: '复制页面说明',
    copied: '已复制',
    manual: '请从下方手动复制',
    close: '关闭',
    prompt:
      '使用 Cineview 1.0.1 设计页面。先根据内容推荐合适的呈现方式，再给出场景计划。说明开场、图文对应关系、停看、退场，以及停手和反向时的行为。先确认设计，再实现。',
  },
  en: {
    nav: 'Main navigation',
    examples: 'Examples',
    guide: 'Design guide',
    docs: 'Docs',
    description: 'Build pages driven by scroll and drag.',
    start: 'Start with an idea',
    view: 'View examples',
    language: 'Page language',
    brief: 'A page brief for AI',
    idea: 'Describe your page idea',
    placeholder: 'I have three images and want to make a portfolio page.',
    copy: 'Copy page brief',
    copied: 'Copied',
    manual: 'Copy the brief below',
    close: 'Close',
    prompt:
      'Design a page with Cineview 1.0.1. Recommend a presentation that fits the content, then propose a scene plan. Show the opening, text/image relationships, reading holds, departure, stopping and reverse input. Confirm the design before implementation.',
  },
} as const;

const HERO_ZONE = { zoneId: 'hero-first-act' };
const HERO_DURATION = { enter: 720, exit: 0 };
const NEUTRAL_ANIMATION = { initial: { opacity: 1 }, animate: { opacity: 1 } };

function HeroArtwork({ progress }: { progress: MotionValue<number> }): React.JSX.Element {
  const clipId = useId();
  // SVG coordinates use the same 1920 width as Cineview; no viewport conversion loop.
  const lineX = useTransform(progress, [130 / 720, 274 / 720], [0, -28.8]);
  const frameDraw = useTransform(progress, [216 / 720, 360 / 720], [1, 0]);
  const frameOpacity = useTransform(progress, [216 / 720, 230 / 720], [0, 1]);
  const revealHeight = useTransform(progress, [317 / 720, 446 / 720], [0, 760]);
  const revealY = useTransform(progress, [317 / 720, 446 / 720], [960, 200]);
  const exitY = useTransform(progress, [562 / 720, 1], [0, -57.6]);
  const exitOpacity = useTransform(progress, [562 / 720, 1], [1, 0.55]);

  return (
    <svg
      className="hero-preview__art"
      viewBox="0 0 1920 1200"
      width="1920"
      height="1200"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <motion.rect x="1296" y={revealY} width="548" height={revealHeight} />
        </clipPath>
      </defs>
      <motion.g style={{ y: exitY, opacity: exitOpacity }}>
        <g clipPath={`url(#${clipId})`} data-hero-plate="">
          <rect x="1296" y="200" width="548" height="760" fill="#f1dfc9" />
          <circle cx="1870" cy="585" r="335" fill="#352820" />
        </g>
        <motion.g style={{ x: lineX }} fill="none" className="hero-preview__curves">
          <path
            d="M 1980 -30 C 1650 105 1280 355 1356 566 C 1410 716 1828 748 1795 974 C 1780 1088 1657 1151 1540 1245"
            stroke="#994f36"
          />
          <path
            d="M 1995 -7 C 1627 118 1226 376 1302 567 C 1360 713 1785 743 1753 973 C 1738 1081 1611 1147 1492 1243"
            stroke="#b99870"
          />
        </motion.g>
        <motion.path
          d="M 1296 200 H 1844 V 960 H 1296 Z"
          pathLength="1"
          fill="none"
          stroke="#b99870"
          strokeWidth="1.6"
          strokeDasharray="1 1"
          style={{ strokeDashoffset: frameDraw, opacity: frameOpacity }}
          data-hero-frame=""
        />
      </motion.g>
    </svg>
  );
}

function AnimatedArtwork(): React.JSX.Element {
  const { progress } = useAnimateTimeline();
  return <HeroArtwork progress={progress} />;
}

export default function HeroPreviewPage(): React.JSX.Element {
  const { lang, setLang } = useI18n();
  const text = COPY[lang];
  const reducedMotion = usePrefersReducedMotion();
  const stillProgress = useMotionValue(0.65);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [idea, setIdea] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const brief = `${idea.trim() || text.placeholder}\n\n${text.prompt}\n\nhttps://cineview.pages.dev/docs`;

  const copyBrief = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(brief);
      setCopyState('copied');
    } catch {
      setCopyState('manual');
    }
  };

  return (
    <main className="hero-preview" lang={lang === 'zh' ? 'zh-CN' : 'en'}>
      <header className="hero-preview__header">
        <Link className="hero-preview__brand" to="/" aria-label="Cineview">
          Cineview
        </Link>
        <nav aria-label={text.nav} className="hero-preview__navigation">
          <Link to="/drag">{text.examples}</Link>
          <Link to="/docs/04-orchestration">{text.guide}</Link>
          <Link to="/docs">{text.docs}</Link>
        </nav>
        <div className="hero-preview__languages" role="group" aria-label={text.language}>
          <button
            type="button"
            lang="zh-CN"
            aria-pressed={lang === 'zh'}
            onClick={() => setLang('zh')}
          >
            中文
          </button>
          <button
            type="button"
            lang="en"
            aria-pressed={lang === 'en'}
            onClick={() => setLang('en')}
          >
            EN
          </button>
        </div>
      </header>

      <Cineview
        mode="scroll"
        designWidth={1920}
        scrollbar={{ enabled: true, autoHide: false, thumbColor: '#b99870' }}
      >
        <Scene
          sceneId="hero-first-act"
          layout={{ height: '100vh', overflow: 'clip' }}
          scroll={reducedMotion ? undefined : HERO_ZONE}
        >
          <section className="hero-preview__canvas" aria-labelledby="hero-preview-title">
            {reducedMotion ? (
              <HeroArtwork progress={stillProgress} />
            ) : (
              <Animate
                animateId="hero-art"
                enterAnimation={NEUTRAL_ANIMATION}
                duration={HERO_DURATION}
              >
                <AnimatedArtwork />
              </Animate>
            )}
            <div className="hero-preview__copy">
              <h1 id="hero-preview-title" className="hero-preview__title">
                Cineview
              </h1>
              <p className="hero-preview__description">{text.description}</p>
              <div className="hero-preview__actions">
                <button
                  type="button"
                  className="hero-preview__primary"
                  onClick={() => dialogRef.current?.showModal()}
                >
                  {text.start}
                </button>
                <Link className="hero-preview__secondary" to="/drag">
                  {text.view}
                </Link>
              </div>
            </div>
          </section>
        </Scene>
      </Cineview>

      <dialog
        ref={dialogRef}
        className="hero-preview__dialog"
        aria-labelledby="hero-brief-title"
        onClose={() => setCopyState('idle')}
      >
        <div className="hero-preview__dialog-heading">
          <h2 id="hero-brief-title">{text.brief}</h2>
          <button type="button" onClick={() => dialogRef.current?.close()} aria-label={text.close}>
            ×
          </button>
        </div>
        <label htmlFor="hero-page-idea">{text.idea}</label>
        <textarea
          id="hero-page-idea"
          value={idea}
          placeholder={text.placeholder}
          onChange={(event) => {
            setIdea(event.target.value);
            setCopyState('idle');
          }}
        />
        <div className="hero-preview__dialog-actions">
          <button
            type="button"
            className="hero-preview__primary"
            onClick={() => {
              void copyBrief();
            }}
          >
            {text.copy}
          </button>
          <Link to="/docs">{text.docs}</Link>
          <span role="status">
            {copyState === 'copied' ? text.copied : copyState === 'manual' ? text.manual : ''}
          </span>
        </div>
        {copyState === 'manual' && (
          <textarea
            className="hero-preview__manual-copy"
            aria-label={text.brief}
            readOnly
            value={brief}
          />
        )}
      </dialog>
    </main>
  );
}
