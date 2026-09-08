import { useState, type ReactNode } from 'react';
import { Animate } from 'cineview';
import { useI18n } from '../i18n';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import './Act3DollyScene.css';

type SequenceMode = 'sequential' | 'simultaneous';

const ENTER_MS = 600;
const GAP_MS = 160;
const ENTRY = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

function ReplayIcon(): import('react').JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 5.5A5 5 0 1 1 3.2 11M3 2v4h4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SequenceElement({
  id,
  after,
  reduced,
  children,
}: {
  id: 'title' | 'copy' | 'credit';
  after?: 'title' | 'copy';
  reduced: boolean;
  children: ReactNode;
}): import('react').JSX.Element {
  return (
    <div className="sequence-demo__content" data-sequence-element={id}>
      {reduced ? (
        children
      ) : (
        <Animate
          animateId={id}
          enterAnimation={ENTRY}
          duration={{ enter: ENTER_MS }}
          timeline={after ? { after, delay: GAP_MS } : { delay: 0 }}
          visibility={{ replay: false }}
        >
          {children}
        </Animate>
      )}
    </div>
  );
}

function SequencePreview({
  mode,
  reduced,
  lang,
}: {
  mode: SequenceMode;
  reduced: boolean;
  lang: 'en' | 'zh';
}): import('react').JSX.Element {
  const sequential = mode === 'sequential';

  return (
    <div className="sequence-demo__preview" data-sequence-mode={mode}>
      <div className="sequence-demo__part">
        <span className="sequence-demo__part-label">01 / TITLE</span>
        <SequenceElement id="title" reduced={reduced}>
          <h3 className="sequence-demo__preview-title">CineView</h3>
        </SequenceElement>
      </div>
      <div className="sequence-demo__part">
        <span className="sequence-demo__part-label">02 / COPY</span>
        <SequenceElement id="copy" after={sequential ? 'title' : undefined} reduced={reduced}>
          <p className="sequence-demo__preview-copy">
            {lang === 'zh'
              ? '滚动、拖拽，编排每一次入场。'
              : 'Scroll. Drag. Give every entrance its moment.'}
          </p>
        </SequenceElement>
      </div>
      <div className="sequence-demo__part">
        <span className="sequence-demo__part-label">03 / CREDIT</span>
        <SequenceElement id="credit" after={sequential ? 'copy' : undefined} reduced={reduced}>
          <p className="sequence-demo__preview-credit">
            <span aria-hidden="true">—</span>
            {lang === 'zh' ? '由你编排' : 'A scene by you'}
          </p>
        </SequenceElement>
      </div>
    </div>
  );
}

/** Only user actions remount the native Animate chain; frame updates stay in Animate. */
export function Act3DollyScene(): import('react').JSX.Element {
  const { lang } = useI18n();
  const reduced = usePrefersReducedMotion();
  const [mode, setMode] = useState<SequenceMode>('sequential');
  const [replay, setReplay] = useState(0);
  const sequential = mode === 'sequential';
  const delay = reduced ? 0 : GAP_MS;
  const config = sequential
    ? `title:  { delay: 0 }\ncopy:   { after: "title", delay: ${delay} }\ncredit: { after: "copy", delay: ${delay} }`
    : 'title:  { delay: 0 }\ncopy:   { delay: 0 }\ncredit: { delay: 0 }';

  const selectMode = (next: SequenceMode): void => {
    setMode(next);
    setReplay((previous) => previous + 1);
  };

  return (
    <section className="sequence-demo" data-lang={lang} aria-labelledby="sequence-demo-title">
      <div className="sequence-demo__inner">
        <header className="sequence-demo__header">
          <p className="sequence-demo__slate">03 / SEQUENCE</p>
          <h2 id="sequence-demo-title">
            {lang === 'zh' ? (
              <>先后，还是同时？</>
            ) : (
              <>
                You set <em>the order.</em>
              </>
            )}
          </h2>
          <p>
            {lang === 'zh'
              ? '切换顺序，看同一组元素如何入场。'
              : 'Change the timing. Watch the same three elements enter.'}
          </p>
        </header>

        <div className="home-demo-controls sequence-demo__controls">
          <div
            className="sequence-demo__mode"
            role="group"
            aria-label={lang === 'zh' ? '入场顺序' : 'Entrance order'}
          >
            <button
              type="button"
              className="home-demo-button"
              aria-pressed={sequential}
              onClick={() => selectMode('sequential')}
            >
              {lang === 'zh' ? '依次入场' : 'One by one'}
            </button>
            <button
              type="button"
              className="home-demo-button"
              aria-pressed={!sequential}
              onClick={() => selectMode('simultaneous')}
            >
              {lang === 'zh' ? '同时入场' : 'All at once'}
            </button>
          </div>
          <button
            type="button"
            className="home-demo-button sequence-demo__replay"
            onClick={() => setReplay((previous) => previous + 1)}
          >
            <ReplayIcon />
            {lang === 'zh' ? '重播' : 'Replay'}
          </button>
        </div>

        <SequencePreview
          key={reduced ? 'static' : replay}
          mode={mode}
          reduced={reduced}
          lang={lang}
        />

        <div className="sequence-demo__configuration">
          <div className="sequence-demo__config-label">
            <span>timeline</span>
            <span>duration.enter: {reduced ? 0 : ENTER_MS} ms</span>
          </div>
          <pre>
            <code>{config}</code>
          </pre>
        </div>
        <p className="sequence-demo__note" aria-live="polite">
          {reduced
            ? lang === 'zh'
              ? '已减少动态效果，三个元素保持可见。'
              : 'Reduced motion is on. All three elements stay visible.'
            : sequential
              ? lang === 'zh'
                ? '上一段完成后，再等待 160 ms。'
                : 'Each element waits 160 ms after the previous one finishes.'
              : lang === 'zh'
                ? '三个元素同时开始，各播放 600 ms。'
                : 'All three start together, each playing for 600 ms.'}
        </p>
      </div>
    </section>
  );
}
