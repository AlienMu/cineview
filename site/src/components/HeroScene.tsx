import { Link } from 'react-router-dom';
import { Animate, Position } from 'cineview';
import { useI18n } from '../i18n';

const GITHUB_URL = 'https://github.com/AlienMu/cineview';

function IconArrow(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 8h9M8.5 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBook(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2.5 3.2c2-0.7 3.6-0.7 5.5 0.4 1.9-1.1 3.5-1.1 5.5-0.4v8.6c-2-0.7-3.6-0.7-5.5 0.4-1.9-1.1-3.5-1.1-5.5-0.4V3.2zM8 3.6v8.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconGithub(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

const PREFERS_REDUCED =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 入场时序常量(ms)。与 Animate 的 waitFor 折叠公式对齐:
//   title(链头)→ slogan(waitFor title)→ intro 打字(stagger 逐字,自身 duration 占时长)
//   → buttons(waitFor intro)→ hint(waitFor btn-2)。
const TITLE_DELAY = 160;
const TITLE_DUR = 720;
const SLOGAN_DUR = 880;
// slogan 两排交叠衔接:row1 不等 row0 完全落定,而是在 row0 播到约 60% 时起身,
// 形成连贯接力而非"完成→停顿→再起"的卡顿。负 overlap = 交叠量(ms)。
const SLOGAN_OVERLAP = 580;
const CHAR_INTERVAL = 32; // 每字符错峰间隔,喂 stagger.each
const CHAR_DUR = 460; // 单字符 reveal 时长(变体 transition.duration)
const BTN_DUR = 560;
const HINT_DUR = 640;
const BEAM_TIMES = [0, 0.14, 0.25, 0.39, 0.5, 0.65, 0.75, 0.9, 1];

function heldVariant(): {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
} {
  return { initial: { opacity: 1 }, animate: { opacity: 1 } };
}

// intro 逐字变体(淡入 + 微上移)。预设无 fade-up,直接传 CustomAnimation:
// stagger 保留 transition.duration(单字符 reveal 时长)并叠加 per-index delay。
// reduced-motion 下 reveal 时长归零(瞬间到位)——框架不碰 matchMedia,由使用方接管。
function introCharVariant(reduced: boolean): {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
} {
  return {
    initial: { opacity: 0, y: '15%' },
    animate: { opacity: 1, y: 0, transition: { duration: reduced ? 0 : CHAR_DUR / 1000 } },
  };
}

// slogan 自定义小位移 slide 动画（自身宽度的 4%，预设 100% 太大）
function sloganSlideVariant(direction: 'left' | 'right'): {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
} {
  const offsetX = direction === 'left' ? '4%' : '-4%';
  return {
    initial: { x: offsetX, opacity: 0 },
    animate: { x: 0, opacity: 1 },
  };
}

// button 组合入场动画：slide-up + fade-in
function buttonEnterVariant(): {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
} {
  return {
    initial: { y: '42%', opacity: 0 },
    animate: { y: 0, opacity: 1 },
  };
}

// intro 逐字 span + 换行处一个全宽 break span(靠 .hero__intro 的 flex-wrap 强制折行)。
// 每个 span 是 stagger 的直接子元素,由框架原生 variant 传播错峰揭示(方案B)。
function buildIntroItems(intro: string): JSX.Element[] {
  const items: JSX.Element[] = [];
  let key = 0;
  const lines = intro.split('\n');
  lines.forEach((line, lineIdx) => {
    for (const ch of Array.from(line)) {
      items.push(
        <span key={key++} className="hero__intro-char">
          {ch}
        </span>
      );
    }
    if (lineIdx < lines.length - 1) {
      items.push(<span key={key++} className="hero__intro-break" aria-hidden="true" />);
    }
  });
  return items;
}

/**
 * 第一幕 Hero。布局与入场时序全部由框架能力驱动:
 *   - 布局:单个 <Position anchor:'center'> 锚整块,内部 flex column(框架定位系统)。
 *   - 时序:<Animate> 的 enterAnimation + duration + timeline.waitFor 声明式串联,
 *     title → slogan(两行 slide-right/left 视差)→ intro(Tier 2 stagger 逐字揭示)
 *     → buttons(slide-up 错峰,waitFor='hero-intro')→ hint。
 *
 * intro 打字使用框架 Tier 2 stagger。slogan 光束与滚动提示使用 infiniteAnimation，
 * 由框架 phase 门控；光束通过继承 CSS 变量投影到 background-position。
 *
 * reduced-motion:所有 Animate duration/delay 归零(瞬间到位),stagger each=0 一次铺开;
 *   infiniteAnimation 不注册，保留静态终态。
 */
export function HeroScene(): JSX.Element {
  const { t, lang } = useI18n();
  const reduced = PREFERS_REDUCED;
  const dur = (ms: number): number => (reduced ? 0 : ms);

  const intro = t('hero.intro');
  const sloganLines = t('hero.slogan').split('\n');
  const introItems = buildIntroItems(intro);
  return (
    <>
      {/* 四排整块用单个 Position 锚到屏幕中心,排间距交给 flex column 的 gap 自动堆叠,
          不再手算各排 y(slogan 高度随字号/语言变,手算必重叠)。区块内部用普通 CSS。 */}
      <Position at={{ anchor: 'center' }}>
        <div className="hero__stack">
          <Animate
            animateId="hero-title"
            enterAnimation="slide-up"
            duration={{ enter: dur(TITLE_DUR) }}
            timeline={{ delay: dur(TITLE_DELAY) }}
          >
            <p className="hero__title">{t('hero.title')}</p>
          </Animate>

          <Animate
            animateId="hero-beam-clock"
            enterAnimation={heldVariant()}
            duration={{ enter: 0 }}
            timeline={{ waitFor: 'hero-slogan-1' }}
            infiniteAnimation={
              reduced
                ? undefined
                : {
                    animate: {
                      '--hero-beam-row-0': [
                        '100%',
                        '44%',
                        '0%',
                        '0%',
                        '0%',
                        '0%',
                        '40%',
                        '100%',
                        '100%',
                      ],
                      '--hero-beam-row-1': [
                        '100%',
                        '100%',
                        '56%',
                        '0%',
                        '0%',
                        '60%',
                        '100%',
                        '100%',
                        '100%',
                      ],
                      transition: {
                        duration: 16,
                        times: BEAM_TIMES,
                        ease: 'linear',
                        repeat: Infinity,
                      },
                    },
                  }
            }
          >
            <h1 className="hero__slogan" data-lang={lang}>
              {sloganLines.map((line, i) => {
                const persist = lang === 'zh' ? (i === 0 ? -44 : 44) : 0;
                return (
                  <Animate
                    key={i}
                    animateId={`hero-slogan-${i}`}
                    enterAnimation={sloganSlideVariant(i === 0 ? 'right' : 'left')}
                    duration={{ enter: dur(SLOGAN_DUR) }}
                    timeline={{
                      waitFor: 'hero-title',
                      delay: i === 0 ? 0 : dur(SLOGAN_DUR - SLOGAN_OVERLAP),
                    }}
                  >
                    <span
                      className="hero__slogan-line"
                      data-row={i}
                      style={
                        persist
                          ? { transform: `translateX(calc(${persist} * var(--cv-u)))` }
                          : undefined
                      }
                    >
                      {line}
                    </span>
                  </Animate>
                );
              })}
            </h1>
          </Animate>

          {/* intro 逐字揭示使用框架 stagger；有效组时长由直接子项数量、each 与子项
              transition.duration 自动结算，buttons 的 waitFor 会等最后一个字符完成。 */}
          <Animate
            animateId="hero-intro"
            enterAnimation={introCharVariant(reduced)}
            stagger={{ each: dur(CHAR_INTERVAL) }}
            timeline={{ waitFor: 'hero-slogan-1' }}
          >
            <p className="hero__intro" data-lang={lang}>
              {introItems}
            </p>
          </Animate>

          <div className="hero__cta">
            <Animate
              animateId="hero-btn-0"
              enterAnimation={buttonEnterVariant()}
              duration={{ enter: dur(BTN_DUR) }}
              timeline={{ waitFor: 'hero-intro', delay: 50 }}
            >
              <Link className="btn btn--primary" to="/docs/quickstart">
                <IconArrow />
                {t('hero.ctaStart')}
              </Link>
            </Animate>
            <Animate
              animateId="hero-btn-1"
              enterAnimation={buttonEnterVariant()}
              duration={{ enter: dur(BTN_DUR) }}
              timeline={{
                waitFor: 'hero-intro',
                delay: 150,
              }}
            >
              <Link className="btn btn--ghost" to="/docs/cineview">
                <IconBook />
                {t('hero.ctaApi')}
              </Link>
            </Animate>
            <Animate
              animateId="hero-btn-2"
              enterAnimation={buttonEnterVariant()}
              duration={{ enter: dur(BTN_DUR) }}
              timeline={{
                waitFor: 'hero-intro',
                delay: 200,
              }}
            >
              <a className="btn btn--ghost" href={GITHUB_URL} target="_blank" rel="noreferrer">
                <IconGithub />
                {t('hero.ctaGithub')}
              </a>
            </Animate>
          </div>
        </div>
      </Position>

      <Position at={{ anchor: 'center', y: 360 }}>
        <Animate
          animateId="hero-hint"
          enterAnimation="fade-in"
          duration={{ enter: dur(HINT_DUR) }}
          timeline={{ waitFor: 'hero-btn-2', delay: 0 }}
          infiniteAnimation={
            reduced
              ? undefined
              : {
                  animate: {
                    y: [0, 6, 0],
                    opacity: [0.5, 1, 0.5],
                    transition: { duration: 2, ease: 'easeInOut', repeat: Infinity },
                  },
                }
          }
        >
          <span className="hero__scroll-hint mono" aria-hidden="true">
            {t('hero.scrollHint')}
          </span>
        </Animate>
      </Position>
    </>
  );
}
