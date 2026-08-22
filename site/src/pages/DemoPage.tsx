import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Animate, AnimateVideo, CineView, Container, Scene } from 'cineview';
import type { CineViewRef, ZoneProgressDetail } from 'cineview';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

type DemoMode = 'drag' | 'scroll';

const DRAG_SCENES = [
  { label: '01', title: 'Render lane', color: '#d9e9ed' },
  { label: '02', title: 'Element track', color: '#ede2d2' },
  { label: '03', title: 'Settle handshake', color: '#e3dcea' },
];

/**
 * zone 进度读数 —— 走公共回调 onZoneProgress + ref 命令式投影（task-flow
 * 2026-08-23 T1.6）。每帧 progress 只改 transform/textContent，零 React
 * 重渲染；这正是框架文档 callbacks 页教给消费者的读数模式。
 */
interface ZoneReadoutHandle {
  project: (progress: number) => void;
}

const ZoneReadout = forwardRef<ZoneReadoutHandle>(function ZoneReadout(_, ref) {
  const fillRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  useImperativeHandle(ref, () => ({
    project: (progress: number): void => {
      const clamped = Math.min(Math.max(progress, 0), 1);
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${clamped})`;
      if (labelRef.current) labelRef.current.textContent = `${Math.round(clamped * 100)}%`;
    },
  }));
  return (
    <div className="demo-zone-readout">
      <div className="demo-zone-readout__track" aria-hidden="true">
        <div ref={fillRef} className="demo-zone-readout__fill" />
      </div>
      <span ref={labelRef} className="demo-zone-readout__label mono">
        0%
      </span>
    </div>
  );
});

/**
 * enterRef 手动入场交互位 —— visibility 轨（timeline.sceneControlled: false）是
 * 时间驱动轨，enterRef 在此受支持；scrub 轨结构上不可能支持（唯一所有者）。
 * 无 delay 时自动入场被抑制，元素停在 initial 帧直到按钮触发；粘性所有权意味着
 * 再次入场需滚出视口再回来（replayOnReenter）—— hint 文案教的就是这条规则。
 */
function ManualEnterSlot({
  card,
  button,
  hint,
}: {
  card: string;
  button: string;
  hint: string;
}): JSX.Element {
  const enterRef = useRef<(() => void) | null>(null);
  return (
    <div className="demo-manual">
      <Animate
        animateId="demo-manual-card"
        enterAnimation="slide-up"
        duration={{ enter: 640 }}
        timeline={{ sceneControlled: false }}
        visibility={{ replayOnReenter: true }}
        enterRef={enterRef}
      >
        <p className="demo-manual__card">{card}</p>
      </Animate>
      <button type="button" className="btn btn--ghost" onClick={() => enterRef.current?.()}>
        {button}
      </button>
      <p className="demo-manual__hint">{hint}</p>
    </div>
  );
}

interface ScrollDemoCopy {
  subline: string;
  videoLabel: string;
  manualCard: string;
  manualButton: string;
  manualHint: string;
}

function ScrollDemo({ copy }: { copy: ScrollDemoCopy }): JSX.Element {
  const readoutRef = useRef<ZoneReadoutHandle>(null);
  // 回调身份稳定；progress 经 ref 命令式下发给读数，不经过 React state。
  const handleZoneProgress = useCallback((detail: ZoneProgressDetail): void => {
    if (detail.zoneId !== 'demo-scroll-zone') return;
    readoutRef.current?.project(detail.progress);
  }, []);

  return (
    <CineView
      config={{ size: 1440 }}
      mode="scroll"
      callbacks={{ onZoneProgress: handleZoneProgress }}
    >
      <Scene sceneId="demo-scroll-intro" layout={{ width: '100%', height: '80vh' }}>
        <div className="demo-stage__document">
          <span className="demo-stage__index mono">SCROLL / NATIVE FLOW</span>
          <h2>Document distance stays real.</h2>
          <p>Scroll normally until a declared zone reaches its center anchor.</p>
        </div>
      </Scene>
      <Scene
        sceneId="demo-scroll-zone"
        layout={{ width: '100%', height: '100vh', overflow: 'hidden' }}
        scroll={{ zoneId: 'demo-scroll-zone', trigger: 'center-lock' }}
      >
        <div className="demo-stage__scene demo-stage__scene--scroll">
          <Container>
            <span className="demo-stage__index mono">CENTER-LOCK / ZONE</span>
            <ZoneReadout ref={readoutRef} />
            <Animate
              animateId="demo-scroll-title"
              enterAnimation="focus-in"
              timeline={{ phase: { start: 0.05, end: 0.3 } }}
            >
              <h2>Progress becomes the scene timeline.</h2>
            </Animate>
            {/* waitFor 级联沿滚动推进：subline 在 title 入场完成前被链住。
                注：waitFor 与 phase 是互斥的 timeline 形态（types 判别联合），
                链式定位由 registry 的 calculatedDelay 累加自动完成。 */}
            <Animate
              animateId="demo-scroll-subline"
              enterAnimation="slide-up"
              duration={{ enter: 600 }}
              timeline={{ waitFor: 'demo-scroll-title', delay: 0 }}
            >
              <p>{copy.subline}</p>
            </Animate>
            {/* 帧擦洗交互位：drag/scroll 位置即 currentTime，反向倒放。
                scrub 视频须全关键帧编码（docs 进阶·性能）。
                注：AnimateVideo 的 timeline 只收 delay/waitFor（窄内联类型），
                链式挂接由 waitFor 完成。 */}
            <AnimateVideo
              src="/video.mp4"
              animateId="demo-zone-video"
              duration={{ enter: 6000 }}
              timeline={{ waitFor: 'demo-scroll-subline', delay: 0 }}
              width={480}
              height={270}
              aria-label={copy.videoLabel}
            />
            <ManualEnterSlot
              card={copy.manualCard}
              button={copy.manualButton}
              hint={copy.manualHint}
            />
          </Container>
        </div>
      </Scene>
      <Scene sceneId="demo-scroll-outro" layout={{ width: '100%', height: '80vh' }}>
        <div className="demo-stage__document">
          <span className="demo-stage__index mono">SCROLL / RELEASE</span>
          <h2>Back to the document.</h2>
          <p>Reverse scroll re-enters the same zone from its completed end.</p>
        </div>
      </Scene>
    </CineView>
  );
}

function DragDemo({ cineViewRef }: { cineViewRef: RefObject<CineViewRef> }): JSX.Element {
  return (
    <CineView ref={cineViewRef} config={{ size: 750 }} mode="drag">
      {DRAG_SCENES.map((scene, index) => (
        <Scene
          key={scene.label}
          sceneId={`demo-drag-${scene.label}`}
          layout={{ width: '100%', height: '100vh', overflow: 'hidden' }}
          transition={{ enterAnimation: 'fade-in', exitAnimation: 'fade-out', exitDuration: 360 }}
        >
          <div className="demo-stage__scene" style={{ background: scene.color }}>
            <Container>
              <span className="demo-stage__index mono">{scene.label} / DRAG</span>
              <Animate
                animateId={`demo-drag-title-${scene.label}`}
                enterAnimation="slide-up"
                duration={{ enter: 720 }}
                timeline={{ delay: 120 + index * 60 }}
              >
                <h2>{scene.title}</h2>
              </Animate>
              <p>Scene-owned timing stays continuous while the chapter settles.</p>
            </Container>
          </div>
        </Scene>
      ))}
    </CineView>
  );
}

export default function DemoPage(): JSX.Element {
  const { lang } = useI18n();
  const [mode, setMode] = useState<DemoMode>('drag');
  const cineViewRef = useRef<CineViewRef>(null);
  const copy =
    lang === 'zh'
      ? {
          eyebrow: 'LIVE LAB / 双引擎',
          title: '把场景交给时间轴。',
          lead: '切换模式，直接观察 drag 的场景栈与 scroll 的真实文档接管。',
          drag: 'drag / 拖拽分页',
          scroll: 'scroll / 原生滚动',
          previous: '上一幕',
          next: '下一幕',
          docs: '阅读文档',
          home: '返回首页',
          scrollDemo: {
            subline: 'waitFor 把这一行链在标题入场完成之后——链条随滚动推进。',
            videoLabel: '帧擦洗演示视频',
            manualCard: '这一张卡片停在 initial 帧，等你按按钮。',
            manualButton: 'enterRef.current() — 手动入场',
            manualHint: '粘性所有权：入场后想再看一次，滚出视口再滚回来（replayOnReenter）。',
          },
        }
      : {
          eyebrow: 'LIVE LAB / TWO ENGINES',
          title: 'Give the scene a timeline.',
          lead: 'Switch modes and inspect the drag stack beside real document scroll takeover.',
          drag: 'drag / paged scenes',
          scroll: 'scroll / native flow',
          previous: 'Previous',
          next: 'Next',
          docs: 'Read the docs',
          home: 'Back home',
          scrollDemo: {
            subline:
              'waitFor chains this line after the title finishes — the chain advances with scroll.',
            videoLabel: 'Frame-scrub demo video',
            manualCard: 'This card is held at its initial frame until you press the button.',
            manualButton: 'enterRef.current() — enter manually',
            manualHint:
              'Sticky ownership: to replay, scroll out of the viewport and back (replayOnReenter).',
          },
        };

  return (
    <main className="demo-page">
      <header className="demo-page__header">
        <div>
          <p className="eyebrow mono">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.lead}</p>
        </div>
        <div className="demo-page__actions">
          <Link to="/docs/quickstart" className="btn btn--ghost">
            {copy.docs}
          </Link>
          <Link to="/" className="btn btn--ghost">
            {copy.home}
          </Link>
        </div>
      </header>

      <div className="demo-switcher" role="tablist" aria-label="CineView modes">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'drag'}
          className={mode === 'drag' ? 'is-active' : ''}
          onClick={() => setMode('drag')}
        >
          <span className="mono">01</span>
          {copy.drag}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'scroll'}
          className={mode === 'scroll' ? 'is-active' : ''}
          onClick={() => setMode('scroll')}
        >
          <span className="mono">02</span>
          {copy.scroll}
        </button>
      </div>

      <section className="demo-stage" aria-live="polite">
        {mode === 'drag' ? (
          <DragDemo cineViewRef={cineViewRef} />
        ) : (
          <ScrollDemo copy={copy.scrollDemo} />
        )}
      </section>

      {mode === 'drag' ? (
        <nav className="demo-controls" aria-label="Drag scene navigation">
          <button type="button" onClick={() => cineViewRef.current?.goToScene(0, true)}>
            {copy.previous}
          </button>
          <span className="demo-controls__readout mono">CINEVIEW / {mode.toUpperCase()}</span>
          <button type="button" onClick={() => cineViewRef.current?.goToScene(2, true)}>
            {copy.next}
          </button>
        </nav>
      ) : null}
    </main>
  );
}
