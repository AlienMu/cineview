import type { ReactNode } from 'react';
import { Animate, type AnimationType } from 'cineview';
import { useI18n } from '../i18n';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import './AboutScenesScene.css';

const ENTER = { initial: { y: 32, skewY: 1.5 }, animate: { y: 0, skewY: 0 } };
const EXIT = { exit: { opacity: 0, y: -12, scale: 0.98 } };
const SPREAD_LAYERS = ['back', 'left', 'right', 'details'] as const;
const PAGE_ENTER: AnimationType[] = SPREAD_LAYERS.map((_, index) => ({
  mode: 'parallel',
  animations: [
    { initial: { x: index % 2 ? -28 : 28, y: 24 }, animate: { x: 0, y: 0 } },
    {
      initial: { scale: 0.88, rotate: index % 2 ? -7 : 7, rotateY: index % 2 ? 24 : -24 },
      animate: { scale: 1, rotate: 0, rotateY: 0 },
    },
  ],
}));

type PrincipleKind = 'place' | 'sequence' | 'detail';
interface Principle {
  kind: PrincipleKind;
  title: string;
  description: string;
  delay: number;
}

function EditorialSpread({ layer }: { layer: (typeof SPREAD_LAYERS)[number] }): React.JSX.Element {
  return (
    <svg
      className="about-scenes__spread-art"
      viewBox="0 0 560 420"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      {layer === 'back' ? (
        <>
          <path className="spread-shadow" d="M57 86 291 48l215 57-232 48Z" />
          <path className="spread-page spread-page--back" d="M52 75 286 36l217 56-232 50Z" />
        </>
      ) : null}
      {layer === 'left' ? (
        <>
          <path className="spread-page spread-page--left" d="M42 106 273 68l-9 250-231 38Z" />
          <path className="spread-rule" d="M75 132l139-23M69 151l108-18M65 232l111-18" />
          <path className="spread-ink" d="m75 188 95-16M72 199l72-12" />
          <path className="spread-accent-fill" d="m85 262 106-18-3 64-106 18Z" />
        </>
      ) : null}
      {layer === 'right' ? (
        <>
          <path className="spread-page spread-page--right" d="m273 68 230 24-10 236-220-10Z" />
          <path
            className="spread-rule"
            d="m273 69-9 249M316 117l121 12M313 139l161 15M310 161l102 10M306 245l126 9M304 265l92 7"
          />
          <path className="spread-ink" d="M318 202l132 13M316 216l87 9" />
          <path className="spread-accent-line" d="m319 177 80 8-2 83-80-7Z" />
        </>
      ) : null}
      {layer === 'details' ? (
        <>
          <path className="spread-thread" d="M183 311c38-38 72-43 101-16 27 26 49 30 75 5" />
          <circle className="spread-point" cx="183" cy="311" r="5" />
          <circle className="spread-point spread-point--warm" cx="359" cy="300" r="5" />
          <path className="spread-baseline" d="M32 363h466" />
        </>
      ) : null}
    </svg>
  );
}

function PrincipleMark({ kind }: { kind: PrincipleKind }): React.JSX.Element {
  if (kind === 'place')
    return (
      <svg viewBox="0 0 42 42" role="presentation" aria-hidden="true" focusable="false">
        <path d="M8 12 21 8l13 4-13 4-13-4ZM8 21l13 4 13-4M8 30l13 4 13-4" />
        <path d="M21 8v26" />
      </svg>
    );
  if (kind === 'sequence')
    return (
      <svg viewBox="0 0 42 42" role="presentation" aria-hidden="true" focusable="false">
        <path d="M8 12h10M8 21h16M8 30h22" />
        <circle cx="31" cy="12" r="3" />
        <circle cx="26" cy="21" r="3" />
        <circle cx="34" cy="30" r="3" />
      </svg>
    );
  return (
    <svg viewBox="0 0 42 42" role="presentation" aria-hidden="true" focusable="false">
      <path d="M8 30c4-12 10-18 18-18 4 0 7 2 9 5" />
      <path d="m28 10 7 7-9 1" />
      <circle cx="12" cy="30" r="3" />
    </svg>
  );
}

function Reveal({
  id,
  delay,
  reduced,
  children,
}: {
  id: string;
  delay: number;
  reduced: boolean;
  children: ReactNode;
}): React.JSX.Element {
  if (reduced) return <>{children}</>;
  return (
    <Animate
      animateId={id}
      enterAnimation={ENTER}
      exitAnimation={EXIT}
      duration={{ enter: 500, exit: 360 }}
      timeline={{ driver: 'clock', delay }}
      visibility={{ replay: true, enterMargin: 0, exitMargin: 0 }}
    >
      {children}
    </Animate>
  );
}

export function AboutScenesScene(): React.JSX.Element {
  const { lang } = useI18n();
  const reduced = usePrefersReducedMotion();
  const zh = lang === 'zh';
  const principles: Principle[] = zh
    ? [
        {
          kind: 'place',
          title: '上一段结束，下一段开始',
          description: '标题先入场，结束 120ms 后展开图像。标题时长改变，图像自动顺延。',
          delay: 100,
        },
        {
          kind: 'sequence',
          title: '让一组内容，依次呈现',
          description: '为同组元素设置入场间隔，也可以从最后一项或中间开始展开。',
          delay: 190,
        },
        {
          kind: 'detail',
          title: '按时间播放，或跟随滚动',
          description:
            '介绍内容进入视口后自动播放；需要逐帧展示时，用滚动控制进度，向上滚动即可回看。',
          delay: 280,
        },
      ]
    : [
        {
          kind: 'place',
          title: 'One finishes. The next begins.',
          description:
            'The title enters first. The image follows 120ms after it finishes, even when the title duration changes.',
          delay: 100,
        },
        {
          kind: 'sequence',
          title: 'Reveal a group in sequence',
          description:
            'Set an interval between items. Start from the first, the last, or the center of the group.',
          delay: 190,
        },
        {
          kind: 'detail',
          title: 'Play in time. Follow the scroll.',
          description:
            'Play an introduction when it comes into view, or let scrolling control every frame. Scroll back to retrace it.',
          delay: 280,
        },
      ];

  return (
    <section className="about-scenes" data-lang={lang} aria-labelledby="about-scenes-title">
      <div className="about-scenes__inner">
        <div className="about-scenes__intro">
          <Reveal id="s03-copy" delay={0} reduced={reduced}>
            <header className="about-scenes__header">
              <p className="about-scenes__eyebrow">
                {zh ? '时间线编排' : 'Timeline orchestration'}
              </p>
              <h2 id="about-scenes-title">
                {zh ? (
                  <>
                    先后有序，<em>时间恰好。</em>
                  </>
                ) : (
                  <>
                    Set the order.<em>Find the timing.</em>
                  </>
                )}
              </h2>
              <p>
                {zh
                  ? '把标题、图像与说明安排在同一场景里。设定各自的时长，连接入场的先后，再为下一段留出恰当的间隔。'
                  : 'Bring a title, an image, and its story into one scene. Set their durations, connect their entrances, and choose the pause before the next.'}
              </p>
            </header>
          </Reveal>
          <figure className="about-scenes__spread">
            {SPREAD_LAYERS.map((layer, index) => (
              <div className="about-scenes__spread-layer" key={layer}>
                {reduced ? (
                  <EditorialSpread layer={layer} />
                ) : (
                  <Animate
                    animateId={`s03-spread-${layer}`}
                    enterAnimation={PAGE_ENTER[index]}
                    exitAnimation={{
                      exit: {
                        x: index % 2 ? 16 : -16,
                        y: -12,
                        scale: 0.94,
                        rotate: index % 2 ? 3 : -3,
                        opacity: 0,
                      },
                    }}
                    duration={{ enter: 600, exit: 420 }}
                    timeline={{ driver: 'clock', after: 's03-copy', delay: 120 + index * 90 }}
                    visibility={{ replay: true, enterMargin: 0, exitMargin: 0 }}
                  >
                    <EditorialSpread layer={layer} />
                  </Animate>
                )}
              </div>
            ))}
          </figure>
        </div>
        <div
          className="about-scenes__principles"
          aria-label={zh ? '时间线功能' : 'Timeline features'}
        >
          {principles.map((principle) => (
            <Reveal
              key={principle.kind}
              id={`s03-principle-${principle.kind}`}
              delay={principle.delay}
              reduced={reduced}
            >
              <article className="about-scenes__principle">
                <span className="about-scenes__principle-mark">
                  <PrincipleMark kind={principle.kind} />
                </span>
                <div>
                  <h3>{principle.title}</h3>
                  <p>{principle.description}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
