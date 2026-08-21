/**
 * Stress fixture — 多视频多元素并发下的双模式帧率测量页。
 * 仅用于 examples/performance-test/stress/stress-fps.mjs 探针；不是产品代码。
 * hash 路由：#/drag（drag 模式 3 幕）| #/scroll（scroll 模式 2 个 takeover zone）。
 */
import type { CSSProperties } from 'react';
import { Animate, AnimateVideo, CineView, Scene } from 'cineview';

const VIDEO_A = new URL('../../../../site/public/video.mp4', import.meta.url).href;
const VIDEO_B = new URL('../../../../site/public/act3-edit.mp4', import.meta.url).href;

const ENTER_PRESETS = ['fade-in', 'slide-up', 'zoom-in'] as const;
const ELEMENT_COUNT = 24;

const tileStyle = (i: number): CSSProperties => ({
  position: 'absolute',
  left: `${8 + (i % 6) * 15.5}%`,
  top: `${12 + Math.floor(i / 6) * 18}%`,
  width: '13%',
  height: '14%',
  borderRadius: 8,
  background: `hsl(${(i * 37) % 360} 45% 22%)`,
  display: 'grid',
  placeItems: 'center',
  font: '600 12px system-ui',
  color: '#e5e7eb',
});

const videoStyle = (slot: 0 | 1 | 2): CSSProperties => ({
  position: 'absolute',
  left: `${6 + slot * 31}%`,
  top: '54%',
  width: '28%',
  height: '34%',
  objectFit: 'cover',
  borderRadius: 8,
  background: '#000',
});

/** 3 路 AnimateVideo + ELEMENT_COUNT 个 Animate（stagger 级联 + 4 个 infinite）。 */
function HeavyStack({ idPrefix }: { idPrefix: string }): JSX.Element {
  return (
    <>
      {[VIDEO_A, VIDEO_A, VIDEO_B].map((src, slot) => (
        <AnimateVideo
          key={`v${slot}`}
          src={src}
          animateId={`${idPrefix}-video-${slot}`}
          aria-label={`${idPrefix}-video-${slot}`}
          duration={{ enter: 4000 }}
          scrubRange={[slot * 2, slot * 2 + 8] as [number, number]}
          preload
          style={videoStyle(slot as 0 | 1 | 2)}
        />
      ))}
      {Array.from({ length: ELEMENT_COUNT }, (_, i) => (
        <Animate
          key={i}
          animateId={`${idPrefix}-el-${i}`}
          enterAnimation={ENTER_PRESETS[i % 3]}
          exitAnimation="fade-out"
          duration={{ enter: 600 + (i % 3) * 200, exit: 400 }}
          timeline={{ delay: (i % 12) * 100 }}
          {...(i % 6 === 5 ? { infiniteAnimation: 'pulse' } : {})}
        >
          <div style={tileStyle(i)}>{`${idPrefix}-${i}`}</div>
        </Animate>
      ))}
    </>
  );
}

function DragStressPage(): JSX.Element {
  return (
    <main data-page="stress-drag" style={{ height: '100vh', overflow: 'hidden' }}>
      <CineView
        config={{ size: 390 }}
        mode="drag"
        modes={{ drag: { direction: 'y', transitionDuration: 600 } }}
      >
        <Scene
          sceneId="stress-drag-0"
          layout={{ width: '100%', height: '100vh', overflow: 'hidden' }}
        >
          <div
            style={{ position: 'relative', width: '100%', height: '100%', background: '#0a0a0f' }}
          >
            <HeavyStack idPrefix="d0" />
          </div>
        </Scene>
        <Scene
          sceneId="stress-drag-1"
          layout={{ width: '100%', height: '100vh', overflow: 'hidden' }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              background: '#12121c',
              display: 'grid',
              placeItems: 'center',
              font: '700 28px system-ui',
            }}
          >
            light interlude
          </div>
        </Scene>
        <Scene
          sceneId="stress-drag-2"
          layout={{ width: '100%', height: '100vh', overflow: 'hidden' }}
        >
          <div
            style={{ position: 'relative', width: '100%', height: '100%', background: '#101018' }}
          >
            <HeavyStack idPrefix="d2" />
          </div>
        </Scene>
      </CineView>
    </main>
  );
}

function ScrollStressPage(): JSX.Element {
  return (
    <main data-page="stress-scroll">
      <CineView
        config={{ size: 390 }}
        mode="scroll"
        modes={{ scroll: { direction: 'y', zoneTrigger: 'center-lock' } }}
      >
        <section
          style={{
            height: '100vh',
            background: '#0a0a0f',
            display: 'grid',
            placeItems: 'center',
            font: '700 28px system-ui',
          }}
        >
          hero
        </section>
        <Scene
          sceneId="stress-zone-a"
          layout={{ width: '100%', height: '100vh', overflow: 'hidden' }}
          scroll={{ zoneId: 'zone-a', trigger: 'center-lock' }}
        >
          <div
            style={{ position: 'relative', width: '100%', height: '100%', background: '#0d0d14' }}
          >
            <HeavyStack idPrefix="sa" />
          </div>
        </Scene>
        <section
          style={{
            height: '120vh',
            background: '#15151f',
            display: 'grid',
            placeItems: 'center',
            font: '600 20px system-ui',
          }}
        >
          plain document flow
        </section>
        <Scene
          sceneId="stress-zone-b"
          layout={{ width: '100%', height: '100vh', overflow: 'hidden' }}
          scroll={{ zoneId: 'zone-b', trigger: 'center-lock' }}
        >
          <div
            style={{ position: 'relative', width: '100%', height: '100%', background: '#0b0f14' }}
          >
            <AnimateVideo
              src={VIDEO_A}
              animateId="sb-video-0"
              aria-label="sb-video-0"
              duration={{ enter: 3000 }}
              preload
              style={videoStyle(0)}
            />
            <AnimateVideo
              src={VIDEO_B}
              animateId="sb-video-1"
              aria-label="sb-video-1"
              duration={{ enter: 3000 }}
              preload
              style={videoStyle(1)}
            />
            {Array.from({ length: 12 }, (_, i) => (
              <Animate
                key={i}
                animateId={`sb-el-${i}`}
                enterAnimation={ENTER_PRESETS[i % 3]}
                duration={{ enter: 700 }}
                timeline={{ delay: i * 150 }}
              >
                <div style={tileStyle(i)}>{`sb-${i}`}</div>
              </Animate>
            ))}
          </div>
        </Scene>
        <section
          style={{
            height: '100vh',
            background: '#05070b',
            display: 'grid',
            placeItems: 'center',
            font: '600 20px system-ui',
          }}
        >
          footer
        </section>
      </CineView>
    </main>
  );
}

export default function App(): JSX.Element {
  return window.location.hash.includes('drag') ? <DragStressPage /> : <ScrollStressPage />;
}
