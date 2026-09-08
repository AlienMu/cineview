/**
 * CineView minimal teaching example.
 *
 * Living source of truth for the framework README "Minimal Usage" snippet and
 * the getting-started doc page (task-flow 2026-08-23 M3): doc code blocks are
 * excerpted from this file — change it and the docs together, never apart.
 *
 * One declarative tree, two engines. The top bar switches `mode`; the scroll
 * takeover declaration on the middle scene is inert under drag and drives a
 * center-lock zone under scroll (see useSceneScrollTakeover's mode gate).
 */

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Animate, CineView, Scene } from 'cineview';
import type { ScrollMode } from 'cineview';

const stage: CSSProperties = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  textAlign: 'center',
  padding: '0 24px',
};

const toggleStyle: CSSProperties = {
  position: 'fixed',
  top: 12,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 1000,
  padding: '6px 14px',
  fontFamily: 'inherit',
  background: '#fff',
  border: '1px solid #111',
  cursor: 'pointer',
};

export default function App(): import('react').JSX.Element {
  const [mode, setMode] = useState<ScrollMode>('drag');
  const next = mode === 'drag' ? 'scroll' : 'drag';

  const scenes = (
    <>
      {/* Scene 1 — no scroll declaration: drag pages to it; in scroll mode
          it is ordinary document flow and its Animate gates on visibility. */}
      <Scene
        sceneId="intro"
        layout={{ width: '100%', height: '100vh', overflow: 'hidden' }}
        transition={{ enterAnimation: 'fade-in', exitAnimation: 'fade-out', exitDuration: 360 }}
      >
        <div style={{ ...stage, background: '#fff' }}>
          <Animate animateId="kicker" enterAnimation="fade-in" duration={{ enter: 600 }}>
            <p>Scene 01 — {mode} engine</p>
          </Animate>
          <h1>CineView</h1>
          <p>Drag vertically, or scroll, to move through the story.</p>
        </div>
      </Scene>

      {/* Scene 2 — the same declaration is read by both engines: ignored by
          drag, and under scroll it turns this scene into a center-lock zone
          whose real scroll distance (1ms = 1px) drives the `after` cascade
          below: "headline" finishes entering before "subline" starts. */}
      <Scene
        sceneId="story"
        layout={{ width: '100%', height: '100vh', overflow: 'hidden' }}
        transition={{ enterAnimation: 'fade-in', exitAnimation: 'fade-out', exitDuration: 360 }}
        scroll={{ zoneId: 'story', trigger: 'center-lock' }}
      >
        <div style={{ ...stage, background: '#f2f2f3' }}>
          <Animate animateId="headline" enterAnimation="fade-in" duration={{ enter: 800 }}>
            <h2>Scene 02 — cascade</h2>
          </Animate>
          <Animate
            animateId="subline"
            enterAnimation="slide-up"
            exitAnimation="fade-out"
            duration={{ enter: 600, exit: 300 }}
            timeline={{ after: 'headline' }}
          >
            <p>This line waits for the headline to finish entering.</p>
          </Animate>
        </div>
      </Scene>

      {/* Scene 3 — plain content; no Animate needed to close the story. */}
      <Scene
        sceneId="outro"
        layout={{ width: '100%', height: '100vh', overflow: 'hidden' }}
        transition={{ enterAnimation: 'fade-in', exitAnimation: 'fade-out', exitDuration: 360 }}
      >
        <div style={{ ...stage, background: '#e8e8ea' }}>
          <h2>Scene 03 — end</h2>
          <p>Use the button on top to restart in the other mode.</p>
        </div>
      </Scene>
    </>
  );

  return (
    <>
      <button style={toggleStyle} onClick={() => setMode(next)}>
        mode: {mode} — switch to {next}
      </button>

      {/*
       * Mode is a root-level declaration, not a hot-swappable prop: the two
       * engines own different DOM and runtime state (drag = full-viewport
       * pager; scroll = real document flow), and the framework offers no
       * cross-engine state transfer. Remounting via `key` is the only honest
       * way to switch — every scene re-enters from its initial state. The
       * literal-branch split also keeps TypeScript's mode-discriminated
       * props happy: `mode: 'drag'` and `mode: 'scroll'` accept different
       * config fields and callbacks.
       */}
      {mode === 'drag' ? (
        <CineView key={mode} designWidth={750} mode="drag">
          {scenes}
        </CineView>
      ) : (
        <CineView key={mode} designWidth={750} mode="scroll">
          {scenes}
        </CineView>
      )}
    </>
  );
}
