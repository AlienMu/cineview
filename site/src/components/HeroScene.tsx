import { Link } from 'react-router-dom';
import { Animate, Position } from 'cineview';
import { useI18n } from '../i18n';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

const GITHUB_URL = 'https://github.com/AlienMu/cineview';

function IconArrow(): import('react').JSX.Element {
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

function IconBook(): import('react').JSX.Element {
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

function IconGithub(): import('react').JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

// Enter timing constants (ms). Aligned with Animate's after collapse formula:
//   title (chain head) → slogan (after title) → intro typewriter (stagger per-char, duration occupies time span)
//   → buttons (after intro) → hint (after btn-2).
const TITLE_DELAY = 160;
const TITLE_DUR = 720;
const SLOGAN_DUR = 880;
// slogan two rows overlap handoff: row1 doesn't wait for row0 to fully settle, but starts when row0 plays to ~60%,
// forming a continuous relay instead of "complete → pause → start again" stuttering. Negative overlap = overlap amount (ms).
const SLOGAN_OVERLAP = 580;
const CHAR_INTERVAL = 32; // Per-character stagger interval, fed to stagger.each
const CHAR_DUR = 460; // Single character reveal duration (variant transition.duration)
const BTN_DUR = 560;
const HINT_DUR = 640;
const BEAM_TIMES = [0, 0.14, 0.25, 0.39, 0.5, 0.65, 0.75, 0.9, 1];

function heldVariant(): {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
} {
  return { initial: { opacity: 1 }, animate: { opacity: 1 } };
}

// intro per-char variant (fade-in + slight upward shift). Preset has no fade-up, pass CustomAnimation directly:
// stagger preserves transition.duration (single char reveal duration) and adds per-index delay.
// reduced-motion: reveal duration zeroed (instant arrival) — framework doesn't touch matchMedia, delegated to consumer.
// 2026-08-14 (audit act1-2): zh CJK punctuation center-occupies space, 15% amplitude causes baseline jump during reveal instant
// more noticeable than Latin; zh compressed to 10%, en kept (Latin punctuation sinks to baseline, 15% is precisely refined).
function introCharVariant(
  reduced: boolean,
  lang: string
): {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
} {
  return {
    initial: { opacity: 0, y: lang === 'zh' ? '10%' : '15%' },
    animate: { opacity: 1, y: 0, transition: { duration: reduced ? 0 : CHAR_DUR / 1000 } },
  };
}

// slogan custom small-offset slide animation (4% of own width, preset 100% too large)
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

// button combined enter animation: slide-up + fade-in
function buttonEnterVariant(): {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
} {
  return {
    initial: { y: '42%', opacity: 0 },
    animate: { y: 0, opacity: 1 },
  };
}

// intro per-char span + one full-width break span at line break (forced line break by .hero__intro's flex-wrap).
// Each span is a direct child of stagger, staggered reveal propagated by framework's native variant (solution B).
function buildIntroItems(intro: string): import('react').JSX.Element[] {
  const items: import('react').JSX.Element[] = [];
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
 * Act 1 Hero. Framework positioning and animation timing:
 *   - Layout: Position centers the main flex column; the scroll hint uses the Scene bottom to avoid width-based vertical overlap.
 *   - Timing: <Animate> enterAnimation + duration + timeline.after declaratively chains,
 *     title → slogan (two-row slide-right/left parallax) → intro (Tier 2 stagger per-char reveal)
 *     → buttons (slide-up stagger, after='hero-intro') → hint.
 *
 * intro typewriter uses framework Tier 2 stagger. slogan beam and scroll hint use loopAnimation,
 * gated by framework phase; beam projects to background-position via inherited CSS variables.
 *
 * reduced-motion: all Animate duration/delay zeroed (instant arrival), stagger each=0 unfolds at once;
 *   loopAnimation not registered, preserves static end state.
 */
export function HeroScene(): import('react').JSX.Element {
  const { t, lang } = useI18n();
  const reduced = usePrefersReducedMotion();
  const dur = (ms: number): number => (reduced ? 0 : ms);

  const intro = t('hero.intro');
  const sloganLines = t('hero.slogan').split('\n');
  const introItems = buildIntroItems(intro);
  return (
    <>
      {/* Four-row whole block anchored to screen center by single Position, row spacing delegated to flex column's gap auto-stack,
          no longer hand-calculating each row's y (slogan height varies with font-size/language, hand-calc would overlap). Block internals use ordinary CSS. */}
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
            timeline={{ after: 'hero-slogan-1' }}
            loopAnimation={
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
                      after: 'hero-title',
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

          {/* intro per-char reveal uses framework stagger; effective group duration auto-calculated from direct child count, each, and child
              transition.duration, buttons' after will wait for last character to complete. */}
          <Animate
            animateId="hero-intro"
            enterAnimation={introCharVariant(reduced, lang)}
            stagger={{ each: dur(CHAR_INTERVAL) }}
            timeline={{ after: 'hero-slogan-1' }}
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
              timeline={{ after: 'hero-intro', delay: 50 }}
            >
              <Link className="btn btn--primary" to="/docs/03-quickstart">
                <IconArrow />
                {t('hero.ctaStart')}
              </Link>
            </Animate>
            <Animate
              animateId="hero-btn-1"
              enterAnimation={buttonEnterVariant()}
              duration={{ enter: dur(BTN_DUR) }}
              timeline={{
                after: 'hero-intro',
                delay: 150,
              }}
            >
              {/* Secondary action demoted to text link (2026-08-29 solution a): only one button remains on first screen,
                  API/GitHub are exits, don't share button hierarchy. */}
              <Link className="hero__link" to="/docs/01-cineview">
                <IconBook />
                {t('hero.ctaApi')}
              </Link>
            </Animate>
            <Animate
              animateId="hero-btn-2"
              enterAnimation={buttonEnterVariant()}
              duration={{ enter: dur(BTN_DUR) }}
              timeline={{
                after: 'hero-intro',
                delay: 200,
              }}
            >
              <a className="hero__link" href={GITHUB_URL} target="_blank" rel="noreferrer">
                <IconGithub />
                {t('hero.ctaGithub')}
              </a>
            </Animate>
          </div>
        </div>
      </Position>

      <div className="hero__hint-position">
        <Animate
          animateId="hero-hint"
          enterAnimation="fade-in"
          duration={{ enter: dur(HINT_DUR) }}
          timeline={{ after: 'hero-btn-2', delay: 0 }}
          loopAnimation={
            reduced
              ? undefined
              : {
                  animate: {
                    y: [0, 6, 0],
                    /* 2026-08-14 (audit act1-3): valley 0.5→0.65 — milky peach first screen bottom
                     * 0.5 contrast ~2.1:1, valley instant approaches unreadable; hint is functional indicator
                     * not atmospheric piece. 6px displacement kept. */
                    opacity: [0.65, 1, 0.65],
                    transition: { duration: 2, ease: 'easeInOut', repeat: Infinity },
                  },
                }
          }
        >
          {/* data-lang for global.css's zh letter-spacing override (audit act1-3: 0.16em is catastrophic edge for CJK full-width
              chars, zh compressed to 0.10em; review R2-1 once became dead code due to missing span marker). */}
          <span className="hero__scroll-hint mono" data-lang={lang} aria-hidden="true">
            {t('hero.scrollHint')}
          </span>
        </Animate>
      </div>
    </>
  );
}
