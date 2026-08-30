import { useRef } from 'react';
import { Animate, CineView, Position, Scene } from 'cineview';
import type { CineViewScrollRef, ZoneProgressDetail } from 'cineview';

const CONCURRENT_ANIMATION_COUNT = 8;

function updateCounter(root: HTMLElement | null, key: string): void {
  if (!root) return;
  root.dataset[key] = String(Number(root.dataset[key] ?? 0) + 1);
}

function renderAcceptanceTakeoverScene(zoneId: string, label: string): JSX.Element {
  return (
    <Scene layout={{ height: '100vh' }} scroll={{ zoneId, trigger: 'center-lock' }}>
      <div
        data-zone-content={zoneId}
        style={{
          alignItems: 'center',
          background: zoneId === 'acceptance-zone-a' ? '#0b1320' : '#182419',
          color: '#fff',
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          height: '100%',
          padding: 48,
          width: '100%',
        }}
      >
        <Position at={{ x: 20, y: 20 }} fixed>
          <div
            data-fixed-probe={zoneId}
            style={{ background: '#fff', color: '#111', font: '600 12px system-ui', padding: 8 }}
          >
            {label}
          </div>
        </Position>
        {Array.from({ length: CONCURRENT_ANIMATION_COUNT }, (_, index) => (
          <Animate
            key={`${zoneId}-${index}`}
            animateId={`${zoneId}-motion-${index}`}
            duration={{ enter: 1200 }}
            enterAnimation={{
              initial: {
                opacity: 0,
                x: index % 2 === 0 ? -48 : 48,
                scale: 0.9,
              },
              animate: { opacity: 1, x: 0, scale: 1 },
            }}
          >
            <div
              data-zone-visual={`${zoneId}-${index}`}
              style={{
                alignItems: 'center',
                border: '1px solid rgba(255,255,255,0.32)',
                display: 'flex',
                font: '600 18px system-ui',
                height: 112,
                justifyContent: 'center',
              }}
            >
              {`${label} ${index + 1}`}
            </div>
          </Animate>
        ))}
      </div>
    </Scene>
  );
}

export default function AcceptanceScrollPage(): JSX.Element {
  const rootRef = useRef<HTMLElement>(null);
  const cineViewRef = useRef<CineViewScrollRef>(null);
  const progressHistoryRef = useRef<Array<{ zoneId: string; progress: number; scrollTop: number }>>(
    []
  );
  const progressRef = useRef<Record<string, number>>({
    'acceptance-zone-a': 0,
    'acceptance-zone-b': 0,
  });

  const recordProgress = (detail: ZoneProgressDetail): void => {
    progressRef.current[detail.zoneId] = detail.progress;
    const root = rootRef.current;
    if (!root) return;
    const container = root.querySelector<HTMLElement>('[data-cineview-container="true"]');
    progressHistoryRef.current.push({
      zoneId: detail.zoneId,
      progress: detail.progress,
      scrollTop: container?.scrollTop ?? Number.NaN,
    });
    const key = detail.zoneId === 'acceptance-zone-a' ? 'zoneAProgress' : 'zoneBProgress';
    root.dataset[key] = detail.progress.toFixed(6);
    root.dataset.progressEvents = String(Number(root.dataset.progressEvents ?? 0) + 1);
    root.dataset.progressHistory = JSON.stringify(progressHistoryRef.current);
  };

  return (
    <main
      ref={rootRef}
      data-page="framework-scroll-acceptance"
      data-ready="false"
      data-current-scene="0"
      data-zone-a-progress="0"
      data-zone-b-progress="0"
      data-zone-enters="0"
      data-zone-leaves="0"
      data-progress-events="0"
      data-progress-history="[]"
      data-authored-scenes="5"
      style={{ height: '100vh', overflow: 'hidden' }}
    >
      <button
        hidden
        type="button"
        data-acceptance-action="go-zone-a"
        onClick={() => cineViewRef.current?.goToZone('acceptance-zone-a', { animated: false })}
      />
      <CineView
        ref={cineViewRef}
        callbacks={{
          onReady: () => {
            if (rootRef.current) rootRef.current.dataset.ready = 'true';
          },
          onSceneLeave: (detail) => {
            if (rootRef.current) rootRef.current.dataset.currentScene = String(detail.toIndex);
          },
          onZoneEnter: () => updateCounter(rootRef.current, 'zoneEnters'),
          onZoneLeave: () => updateCounter(rootRef.current, 'zoneLeaves'),
          onZoneProgress: recordProgress,
        }}
        designWidth={390}
        mode="scroll"
        direction="y"
        sceneSizing="content"
        scrollbar={{
          enabled: true,
          ariaLabel: 'Framework scroll acceptance timeline',
          autoHide: false,
          width: 12,
        }}
      >
        <Scene layout={{ height: '100vh' }}>
          <div
            data-document-section="intro"
            style={{
              alignItems: 'center',
              background: '#f5f1e8',
              color: '#171717',
              display: 'flex',
              font: '700 32px system-ui',
              height: '100%',
              justifyContent: 'center',
            }}
          >
            Native document intro
          </div>
        </Scene>
        {renderAcceptanceTakeoverScene('acceptance-zone-a', 'ZONE A')}
        <Scene layout={{ height: '70vh' }}>
          <div
            data-document-section="interlude"
            style={{
              alignItems: 'center',
              background: '#e6edf4',
              color: '#172033',
              display: 'flex',
              font: '700 28px system-ui',
              height: '100%',
              justifyContent: 'center',
            }}
          >
            Native document interlude
          </div>
        </Scene>
        {renderAcceptanceTakeoverScene('acceptance-zone-b', 'ZONE B')}
        <Scene layout={{ height: '110vh' }}>
          <div
            data-document-section="tail"
            style={{
              alignItems: 'center',
              background: '#f4e7e3',
              color: '#321b18',
              display: 'flex',
              font: '700 30px system-ui',
              height: '100%',
              justifyContent: 'center',
            }}
          >
            Native document tail
          </div>
        </Scene>
      </CineView>
    </main>
  );
}
