import React from 'react';
import { Animate, CineView, Position, Scene, ScrollZone } from 'cineview';

function ScrollScene({
  title,
  copy,
  gradient,
}: {
  title: string;
  copy: string;
  gradient: string;
}): JSX.Element {
  return (
    <Scene layout={{ height: 1150, overflow: 'visible' }}>
      <div
        style={{
          minHeight: '1150px',
          position: 'relative',
          padding: '120px 96px 160px',
          background: gradient,
          boxSizing: 'border-box',
        }}
      >
        <Position at={{ x: 32, y: 32 }} layer={{ fixed: true }}>
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 999,
              background: 'rgba(8,10,16,0.8)',
              color: '#fff',
              fontSize: 12,
            }}
          >
            scene-scoped fixed layer
          </div>
        </Position>

        <Animate enterAnimation="fade-in" duration={{ enter: 520 }}>
          <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 14, marginBottom: 18 }}>
            {title}
          </div>
        </Animate>
        <Animate enterAnimation="slide-up" duration={{ enter: 760 }} timeline={{ delay: 120 }}>
          <h1 style={{ color: '#fff', fontSize: 52, lineHeight: 1.1, margin: '0 0 18px' }}>
            {title}
          </h1>
        </Animate>
        <Animate enterAnimation="fade-in" duration={{ enter: 620 }} timeline={{ delay: 220 }}>
          <p
            style={{
              color: 'rgba(255,255,255,0.82)',
              fontSize: 20,
              lineHeight: 1.6,
              margin: 0,
              maxWidth: 680,
            }}
          >
            {copy}
          </p>
        </Animate>

        <ScrollZone zoneId={`${title}-zone`} trigger="center-lock" budget="auto">
          <div style={{ marginTop: 180, display: 'grid', gap: 20, maxWidth: 760 }}>
            <Animate
              animateId={`${title}-probe`}
              enterAnimation="zoom-in"
              duration={{ enter: 1800, exit: 1200 }}
              timeline={{ driver: 'scroll' }}
            >
              <div
                style={{
                  padding: 28,
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                }}
              >
                Fixed host belongs to this scene only.
              </div>
            </Animate>
            <Animate
              animateId={`${title}-followup`}
              enterAnimation="slide-up"
              duration={{ enter: 1000, exit: 800 }}
              timeline={{ driver: 'scroll', delay: 280, waitFor: `${title}-probe` }}
            >
              <div style={{ color: 'rgba(255,255,255,0.78)', fontSize: 18 }}>
                Scroll input advances the zone first, then releases back to document flow.
              </div>
            </Animate>
          </div>
        </ScrollZone>
      </div>
    </Scene>
  );
}

export default function ScrollFixedShowcase(): JSX.Element {
  return (
    <CineView
      mode="scroll"
      modes={{ scroll: { direction: 'y', sceneSizing: 'content' } }}
      config={{ width: 1440, height: 1200, unit: 'px' }}
      scrollbar={{ enabled: true, width: 10 }}
    >
      <ScrollScene
        title="Fixed Layer Scene One"
        copy="The fixed badge is clipped to the current scene's visible slice and released at the boundary."
        gradient="linear-gradient(180deg, #101927 0%, #18273e 100%)"
      />
      <ScrollScene
        title="Fixed Layer Scene Two"
        copy="A second scene gets its own host instead of inheriting the first scene's overlay domain."
        gradient="linear-gradient(180deg, #1d2542 0%, #31406c 100%)"
      />
    </CineView>
  );
}
