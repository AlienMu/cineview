import React from 'react';
import { Animate, CineView, Position, Scene, ScrollZone } from 'cineview';

export default function ScrollTimelinePhaseProbe(): JSX.Element {
  return (
    <CineView
      mode="scroll"
      modes={{ scroll: { direction: 'y', sceneSizing: 'content' } }}
      config={{ width: 1280, height: 1100, unit: 'px' }}
      scrollbar={{ enabled: true, width: 10 }}
    >
      <Scene layout={{ height: 1250 }}>
        <div
          style={{
            minHeight: '1250px',
            background: 'linear-gradient(180deg, #101726 0%, #223453 100%)',
            padding: '100px 88px 200px',
            position: 'relative',
            boxSizing: 'border-box',
          }}
        >
          <Position at={{ x: 88, y: 96 }}>
            <Animate
              enterAnimation="fade-in"
              duration={{ enter: 460 }}
              timeline={{ driver: 'visibility' }}
            >
              <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 14 }}>
                timeline phase probe
              </div>
            </Animate>
          </Position>

          <Position at={{ x: 88, y: 168 }}>
            <Animate
              enterAnimation="slide-up"
              duration={{ enter: 780 }}
              timeline={{ driver: 'visibility' }}
            >
              <h1 style={{ color: '#fff', fontSize: 52, margin: 0 }}>Explicit phase windows</h1>
            </Animate>
          </Position>

          <ScrollZone zoneId="timeline-phase-probe" trigger="center-lock" budget="auto">
            <div style={{ marginTop: 260, display: 'grid', gap: 22, maxWidth: 720 }}>
              <Animate
                animateId="timeline-phase-a"
                enterAnimation="zoom-in"
                duration={{ enter: 1200, exit: 900 }}
                timeline={{ driver: 'scroll', phase: { start: 0.1, end: 0.55 } }}
              >
                <div
                  style={{
                    padding: 24,
                    borderRadius: 16,
                    background: 'rgba(255,255,255,0.08)',
                    color: '#fff',
                  }}
                >
                  phase 0.10 - 0.55
                </div>
              </Animate>

              <Animate
                animateId="timeline-phase-b"
                enterAnimation="slide-up"
                duration={{ enter: 1000, exit: 700 }}
                timeline={{ driver: 'scroll', phase: { start: 0.45, end: 0.9 } }}
              >
                <div
                  style={{
                    padding: 24,
                    borderRadius: 16,
                    background: 'rgba(255,255,255,0.08)',
                    color: '#fff',
                  }}
                >
                  phase 0.45 - 0.90
                </div>
              </Animate>

              <Animate
                animateId="timeline-phase-copy"
                enterAnimation="fade-in"
                duration={{ enter: 620 }}
                timeline={{ driver: 'visibility', delay: 120 }}
              >
                <p
                  style={{
                    color: 'rgba(255,255,255,0.8)',
                    fontSize: 18,
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  This page keeps the example small but still demonstrates grouped `timeline.phase`
                  authoring.
                </p>
              </Animate>
            </div>
          </ScrollZone>
        </div>
      </Scene>
    </CineView>
  );
}
