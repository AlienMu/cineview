import { useState } from 'react';
import { Animate } from 'cineview';
import { useI18n } from '../i18n';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import './EmanationScene.css';

export const EMANATION_POSTERS = [
  '/act3-edit-poster.jpg',
  '/act3-clip-poster-1.jpg',
  '/act3-clip-poster-2.jpg',
  '/act3-clip-poster-3.jpg',
  '/act3-clip-poster-4.jpg',
  '/act3-clip-poster-5.jpg',
];

const FRAME_DURATION = 520;
const FRAME_ENTRY = {
  initial: { opacity: 0, scale: 0.9, y: 18 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { ease: 'easeOut' } },
};
const ORIGINS = ['first', 'center', 'last'] as const;
type Origin = (typeof ORIGINS)[number];
const ORDER = {
  first: '01 → 02 → 03 → 04 → 05 → 06',
  center: '03 / 04 → 02 / 05 → 01 / 06',
  last: '06 → 05 → 04 → 03 → 02 → 01',
};

function entryDelay(index: number, from: Origin, each: number): number {
  const order = from === 'center' ? Math.abs(index - 2.5) : from === 'last' ? 5 - index : index;
  return Math.round(order * each);
}

export function EmanationScene(): import('react').JSX.Element {
  const reduced = usePrefersReducedMotion();
  const { lang } = useI18n();
  const zh = lang === 'zh';
  const [from, setFrom] = useState<Origin>('center');
  const [each, setEach] = useState(160);
  const [replay, setReplay] = useState(0);
  const interval = reduced ? 0 : each;
  const duration = reduced ? 0 : FRAME_DURATION;
  const labels = zh
    ? { first: '第一张', center: '中间两张', last: '最后一张' }
    : { first: 'First', center: 'Center', last: 'Last' };

  // Column flow makes indices 2 and 3 the visible center column.
  const frames = (
    <div
      className="emanation-scene__grid"
      data-stagger-from={from}
      data-stagger-each={interval}
      data-stagger-revision={replay}
      data-stagger-static={reduced}
    >
      {EMANATION_POSTERS.map((src, index) => (
        <figure key={src} className={`emanation-frame emanation-frame--${index}`}>
          <div className="emanation-frame__image">
            <img
              src={src}
              alt={zh ? `电影画面 ${index + 1}` : `Film still ${index + 1}`}
              loading="lazy"
              decoding="async"
            />
          </div>
          <figcaption>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <span>+{entryDelay(index, from, interval)} ms</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );

  return (
    <section className="emanation-scene" data-lang={lang} aria-labelledby="emanation-title">
      <div className="emanation-scene__layout">
        <div className="emanation-scene__settings">
          <header className="emanation-scene__header">
            <p className="emanation-scene__slate">05 / STAGGER</p>
            <h2 id="emanation-title">
              {zh ? (
                <>
                  决定画面的
                  <br />
                  <em>出现顺序。</em>
                </>
              ) : (
                <>
                  Choose what
                  <br />
                  <em>appears first.</em>
                </>
              )}
            </h2>
            <p>
              {zh
                ? '切换起点，调整间隔，比较六张画面的入场。'
                : 'Change the start and interval. Replay the same six frames.'}
            </p>
          </header>

          <div className="emanation-scene__controls">
            <div
              className="emanation-scene__origin"
              role="group"
              aria-labelledby="emanation-origin-label"
            >
              <span id="emanation-origin-label" className="emanation-scene__control-label">
                {zh ? '从哪里开始' : 'Start from'}
              </span>
              <div className="home-demo-controls">
                {ORIGINS.map((origin) => (
                  <button
                    key={origin}
                    type="button"
                    className="home-demo-button"
                    aria-pressed={from === origin}
                    disabled={reduced}
                    data-stagger-origin={origin}
                    onClick={() => {
                      setFrom(origin);
                      setReplay((value) => value + 1);
                    }}
                  >
                    {labels[origin]}
                  </button>
                ))}
              </div>
            </div>
            <div className="emanation-scene__playback">
              <label className="emanation-scene__interval" htmlFor="emanation-interval">
                <span className="emanation-scene__control-label">
                  {zh ? '相邻次序的间隔' : 'Interval between starts'}
                  <output htmlFor="emanation-interval">{interval} ms</output>
                </span>
                <input
                  id="emanation-interval"
                  className="home-demo-range"
                  type="range"
                  min="0"
                  max="320"
                  step="40"
                  value={interval}
                  disabled={reduced}
                  aria-valuetext={`${interval} milliseconds`}
                  onChange={(event) => setEach(Number(event.currentTarget.value))}
                />
              </label>
              <button
                type="button"
                className="home-demo-button home-demo-button--primary emanation-scene__replay"
                disabled={reduced}
                onClick={() => setReplay((value) => value + 1)}
                data-stagger-replay="true"
              >
                <svg
                  viewBox="0 0 20 20"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  aria-hidden="true"
                >
                  <path d="M4 6.5a6 6 0 1 1-1 6M4 2.5v4.5h4.5" />
                </svg>
                {reduced ? (zh ? '静态预览' : 'Still preview') : zh ? '重播' : 'Replay'}
              </button>
            </div>
            <p className="emanation-scene__note" aria-live="polite">
              {reduced
                ? zh
                  ? '已按减少动态效果偏好显示全部画面。'
                  : 'All frames are shown for your reduced motion preference.'
                : each === 0
                  ? zh
                    ? '间隔为 0，六张画面同时开始。'
                    : 'With no interval, all six frames start together.'
                  : from === 'center'
                    ? zh
                      ? '03 和 04 同时开始，再向两边依次出现。'
                      : '03 and 04 start together, then the outer pairs follow.'
                    : zh
                      ? `${labels[from]}先出现，其余每隔 ${each} ms 开始。`
                      : `${labels[from]} frame begins first; the others follow every ${each} ms.`}
            </p>
          </div>

          <pre
            className="emanation-scene__code"
            aria-label={zh ? '当前 Animate 配置' : 'Current Animate configuration'}
          >
            <code>
              {reduced
                ? '<div>\n  {/* Six static frames */}\n</div>'
                : `<Animate\n  duration={{ enter: ${duration} }}\n  stagger={{ each: ${interval}, from: "${from}" }}\n>`}
            </code>
          </pre>
        </div>

        <div className="emanation-scene__gallery">
          <div className="emanation-scene__gallery-heading">
            <span>{zh ? '六张画面 / 同一个动画' : 'SIX FRAMES / ONE ANIMATION'}</span>
            <span>{reduced ? 'STATIC' : `${duration} ms / FRAME`}</span>
          </div>
          {reduced ? (
            frames
          ) : (
            <Animate
              key={`${from}-${each}-${replay}`}
              animateId="emanation-frames"
              enterAnimation={FRAME_ENTRY}
              duration={{ enter: FRAME_DURATION }}
              stagger={{ each, from }}
              visibility={{ replay: false, enterMargin: 0 }}
            >
              {frames}
            </Animate>
          )}
          <p className="emanation-scene__order">
            <span>{zh ? '开始顺序' : 'START ORDER'}</span>
            <span>{interval === 0 ? '01 / 02 / 03 / 04 / 05 / 06' : ORDER[from]}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
