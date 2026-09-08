import { useEffect, useRef, useState } from 'react';
import { Animate, type AnimationType } from 'cineview';
import { useI18n } from '../i18n';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import './EditorialIndexScene.css';

const KINDS = ['combine', 'sequence', 'lifecycle'] as const;
const ENTER: AnimationType = {
  mode: 'parallel',
  animations: [
    { initial: { y: 28 }, animate: { y: 0 } },
    { initial: { scale: 0.95, rotate: -1.5 }, animate: { scale: 1, rotate: 0 } },
  ],
};
const EXIT = { exit: { opacity: 0, y: -12, rotate: 1, scale: 0.97 } };
const COLOR_ENTER: AnimationType = {
  mode: 'parallel',
  animations: [
    { initial: { x: -30, y: 45 }, animate: { x: 0, y: 0 } },
    { initial: { scale: 0.72, rotate: -14 }, animate: { scale: 1, rotate: 0 } },
  ],
};
const DETAIL_LOOP = {
  animate: {
    y: [0, -6, 0],
    rotate: [0, 2, 0],
    transition: { duration: 4, ease: 'easeInOut', repeat: Infinity },
  },
};

const COPY = {
  zh: [
    {
      title: '组合动画',
      headline: ['几个动作，', '一次完成。'],
      description:
        '图像向前移动，同时放大、转正。将位移、缩放、旋转组合在同一段动画中，让一次入场拥有完整的变化。',
      words: ['位移', '缩放', '旋转'],
      specimen: ['移动', '放大 · 转正'],
      note: '多个属性，同时变化。',
      glyph: '+',
    },
    {
      title: '顺序与错峰',
      headline: ['一起编排，', '依次到来。'],
      description:
        '让主图先展开，标题随后出现，说明再依次补齐。用前后依赖连接不同元素，用统一间隔安排同组内容。',
      words: ['前后依赖', '入场间隔', '展开方向'],
      specimen: ['先展开', '再呈现'],
      note: '先完成主图，再展开两行标题。',
      glyph: '→',
    },
    {
      title: '入场、循环与退场',
      headline: ['进入之后，', '细节继续。'],
      description:
        '入场完成后，让局部轻轻往复，正文保持稳定。离开时停止循环，接续专属的退场；再次进入，也能重新播放。',
      words: ['入场', '局部循环', '独立退场'],
      specimen: ['入场完成', '细节继续'],
      note: '局部持续运动，正文保持可读。',
      glyph: '∞',
    },
  ],
  en: [
    {
      title: 'Combined animation',
      headline: ['Several moves.', 'One entrance.'],
      description:
        'An image moves forward, grows, and turns into place. Combine position, scale, and rotation in one animation to shape the whole entrance.',
      words: ['Position', 'Scale', 'Rotation'],
      specimen: ['Move closer.', 'Grow. Turn.'],
      note: 'Several properties change together.',
      glyph: '+',
    },
    {
      title: 'Sequence and stagger',
      headline: ['Composed together.', 'Arriving in order.'],
      description:
        'Open the image, bring in the title, then reveal the details. Connect separate elements by their finish times and space a group with a shared interval.',
      words: ['Dependencies', 'Intervals', 'Direction'],
      specimen: ['First, unfold.', 'Then, reveal.'],
      note: 'The image finishes before the title unfolds.',
      glyph: '→',
    },
    {
      title: 'Enter, loop, and exit',
      headline: ['Arrive once.', 'Keep a detail moving.'],
      description:
        'After the entrance, let one detail repeat while the text stays still. Leaving stops the loop and starts its own exit. Returning can replay the entrance.',
      words: ['Entrance', 'Local loop', 'Exit'],
      specimen: ['Arrive.', 'Keep moving.'],
      note: 'A moving detail. A steady reading area.',
      glyph: '∞',
    },
  ],
};

export function EditorialIndexScene(): React.JSX.Element {
  const { lang } = useI18n();
  const reduced = usePrefersReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const entries = COPY[lang];
  const current = entries[active];

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === 'undefined') return;
    const root = section.closest<HTMLElement>('[data-cineview-container="true"]');
    const onVisibility: IntersectionObserverCallback = (changes) => {
      const current = changes
        // Edge contact is the only threshold-0 notification some scroll positions produce.
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRect.height - a.intersectionRect.height)[0];
      if (current) setActive(Number((current.target as HTMLElement).dataset.compositionStep));
    };
    let observer: IntersectionObserver | undefined;
    const observe = (): void => {
      observer?.disconnect();
      // IntersectionObserver percentage margins use width, even on vertical edges.
      const height = root?.clientHeight || window.innerHeight;
      const stacked = window.matchMedia('(max-width: 650px)').matches;
      const visual = section.querySelector<HTMLElement>('.editorial-index__visual');
      const visualBottom = visual
        ? visual.getBoundingClientRect().height + (parseFloat(getComputedStyle(visual).top) || 0)
        : 0;
      const readingLine = Math.min(
        height - 1,
        Math.round(Math.max(height * 0.32, stacked ? visualBottom + 24 : 0))
      );
      // Keep the last composition inside the viewport until its chapter passes
      // the reading line. This affects natural layout, not a Scene.scroll budget.
      section.style.setProperty(
        '--editorial-tail-space',
        `${Math.max(0, visualBottom - readingLine)}px`
      );
      observer = new IntersectionObserver(onVisibility, {
        root,
        rootMargin: `-${readingLine}px 0px -${height - readingLine - 1}px 0px`,
        threshold: 0,
      });
      section
        .querySelectorAll('[data-composition-step]')
        .forEach((element) => observer?.observe(element));
    };
    observe();
    window.addEventListener('resize', observe);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', observe);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="editorial-index"
      data-lang={lang}
      data-composition={KINDS[active]}
      aria-labelledby="editorial-index-title"
    >
      <div className="editorial-index__inner">
        <header className="editorial-index__header">
          <h2 id="editorial-index-title">
            {lang === 'zh' ? (
              <>
                组合动作，
                <br />
                <em>编排完整的动画。</em>
              </>
            ) : (
              <>
                Combine the moves.
                <br />
                <em>Compose the motion.</em>
              </>
            )}
          </h2>
          <p>
            {lang === 'zh'
              ? '从一个元素的变化，到一组内容的衔接，再到完整的入场与退场。'
              : 'From the movement of one element to a group in sequence, with an entrance and exit for each.'}
          </p>
        </header>
        <div className="editorial-index__body">
          <div className="editorial-index__visual">
            <figure
              className="editorial-index__composition"
              aria-label={lang === 'zh' ? `${current.title}演示` : `${current.title} demonstration`}
            >
              <div className="editorial-index__color-plane" aria-hidden="true">
                {reduced ? (
                  <div className="editorial-index__color-surface">
                    <span>{current.glyph}</span>
                  </div>
                ) : (
                  <Animate
                    key={KINDS[active]}
                    animateId={`s05-art-${KINDS[active]}`}
                    enterAnimation={COLOR_ENTER}
                    exitAnimation={{ exit: { x: 18, scale: 0.86, rotate: 8, opacity: 0 } }}
                    loopAnimation={active === 2 ? DETAIL_LOOP : undefined}
                    duration={{ enter: 650, exit: 420 }}
                    timeline={{ driver: 'clock' }}
                    visibility={{ replay: true, enterMargin: 0, exitMargin: 0 }}
                  >
                    <div className="editorial-index__color-surface">
                      <span>{current.glyph}</span>
                    </div>
                  </Animate>
                )}
              </div>
              <div className="editorial-index__type-plane" aria-hidden="true">
                {reduced ? (
                  <div className="editorial-index__specimen">
                    {current.specimen.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </div>
                ) : (
                  <Animate
                    key={KINDS[active]}
                    animateId={`s05-type-${KINDS[active]}`}
                    enterAnimation={{
                      initial: { y: '100%', rotate: 3 },
                      animate: { y: '0%', rotate: 0 },
                    }}
                    exitAnimation={{ exit: { y: '-100%', rotate: -2 } }}
                    stagger={{ each: 110 }}
                    duration={{ enter: 460, exit: 320 }}
                    timeline={{
                      driver: 'clock',
                      ...(active === 1
                        ? { after: 's05-art-sequence', delay: 100 }
                        : { delay: 120 }),
                    }}
                    visibility={{ replay: true, enterMargin: 0, exitMargin: 0 }}
                  >
                    <div className="editorial-index__specimen">
                      {current.specimen.map((line) => (
                        <span key={line}>{line}</span>
                      ))}
                    </div>
                  </Animate>
                )}
              </div>
              <div className="editorial-index__rule-plane" aria-hidden="true" />
              <div className="editorial-index__text-plane" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="editorial-index__secondary-plane" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className="editorial-index__note-plane" aria-hidden="true">
                {current.note}
              </div>
            </figure>
          </div>
          <div className="editorial-index__chapters">
            {entries.map((entry, index) => {
              const content = (
                <article className="editorial-index__chapter-copy">
                  <p className="editorial-index__kind">{entry.title}</p>
                  <h3>
                    {entry.headline.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </h3>
                  <p className="editorial-index__description">{entry.description}</p>
                  <ul className="editorial-index__contents">
                    {entry.words.map((word) => (
                      <li key={word}>{word}</li>
                    ))}
                  </ul>
                </article>
              );
              return (
                <div
                  key={KINDS[index]}
                  className="editorial-index__chapter"
                  data-composition-step={index}
                  data-editorial-kind={KINDS[index]}
                  data-active={index === active}
                >
                  {reduced ? (
                    content
                  ) : (
                    <Animate
                      animateId={`s05-content-${KINDS[index]}`}
                      enterAnimation={ENTER}
                      exitAnimation={EXIT}
                      duration={{ enter: 600, exit: 360 }}
                      timeline={{ driver: 'clock' }}
                      visibility={{ replay: true, enterMargin: 0, exitMargin: 0 }}
                    >
                      {content}
                    </Animate>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
