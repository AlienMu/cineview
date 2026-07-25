import { useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Animate, CineView, Container, Scene } from 'cineview';
import type { CineViewRef } from 'cineview';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

type DemoMode = 'drag' | 'scroll';

const DRAG_SCENES = [
  { label: '01', title: 'Render lane', color: '#d9e9ed' },
  { label: '02', title: 'Element track', color: '#ede2d2' },
  { label: '03', title: 'Settle handshake', color: '#e3dcea' },
];

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

function ScrollDemo(): JSX.Element {
  return (
    <CineView config={{ size: 1440 }} mode="scroll">
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
            <Animate
              animateId="demo-scroll-title"
              enterAnimation="focus-in"
              timeline={{ phase: { start: 0.12, end: 0.82 } }}
            >
              <h2>Progress becomes the scene timeline.</h2>
            </Animate>
            <p>The zone releases native scrolling after its timeline reaches the boundary.</p>
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
        {mode === 'drag' ? <DragDemo cineViewRef={cineViewRef} /> : <ScrollDemo />}
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
