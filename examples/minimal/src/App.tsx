/**
 * Cineview Minimal Example — Enhanced Teaching Version
 *
 * This example demonstrates mode switching between drag and scroll engines.
 * It's designed to be read AND run — scroll down to see inline explanations.
 *
 * 📚 Looking for copy-paste patterns? Check src/patterns/
 * 📖 Reading the source for the first time? Start here.
 *
 * ---
 *
 * WHY CINEVIEW?
 *
 * Use Cineview when you need scroll distance to directly control animation progress
 * (Apple product pages, Nike campaigns, immersive storytelling). Not for:
 * - Simple fade-in-on-scroll (use Intersection Observer)
 * - Navigation transitions (use Framer Motion)
 * - Data visualizations (use D3/Recharts)
 *
 * The framework's superpower: declarative timeline sequencing that works with
 * scroll scrubbing AND drag gestures from the same component tree.
 */

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Animate, Cineview, Scene } from 'cineview';
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
  // Mode is a root-level choice, not a hot-swappable prop. Drag = full-viewport
  // gesture-driven pager. Scroll = document flow with scrub zones. They have
  // different DOM structures and runtime state, so switching requires remount.
  const [mode, setMode] = useState<ScrollMode>('drag');
  const next = mode === 'drag' ? 'scroll' : 'drag';

  const scenes = (
    <>
      {/* ─────────────────────────────────────────────────────────────────
          SCENE 1: Introduction

          Key concepts shown:
          - Scene: A single scrollable/draggable unit (like a slide)
          - layout: Dimensions in design px (auto-scales to viewport)
          - transition: Scene-level enter/exit animations
          - Animate: Element-level enter animation

          Behavior difference:
          - Drag mode: User swipes vertically to page to this scene
          - Scroll mode: Scrolls into view like normal HTML
      ───────────────────────────────────────────────────────────────── */}
      <Scene
        sceneId="intro"
        layout={{ width: '100%', height: '100vh', overflow: 'hidden' }}
        transition={
          mode === 'scroll'
            ? { enterAnimation: 'fade-in', exitAnimation: 'fade-out', exitDuration: 360 }
            : undefined
        }
      >
        <div style={{ ...stage, background: '#fff' }}>
          <Animate animateId="kicker" enterAnimation="fade-in" duration={{ enter: 600 }}>
            <p>Scene 01 — {mode} engine</p>
          </Animate>
          <h1>Cineview</h1>
          <p>Drag vertically, or scroll, to move through the story.</p>
        </div>
      </Scene>

      {/* ─────────────────────────────────────────────────────────────────
          SCENE 2: Timeline Sequencing

          Key concepts shown:
          - scroll.zoneId: Groups animations that scrub together
          - scroll: Viewport center triggers this zone,
            scrolling "locks" until animations complete (1ms = 1px budget)
          - timeline.after: "Start after another animation finishes"

          Behavior difference:
          - Drag mode: scroll prop is ignored, animations play on scene enter
          - Scroll mode: Real scroll distance controls animation progress

          WHY THIS MATTERS:
          The same declarative tree works in both modes. You write the story
          once, Cineview adapts it to the input method.
      ───────────────────────────────────────────────────────────────── */}
      <Scene
        sceneId="story"
        layout={{ width: '100%', height: '100vh', overflow: 'hidden' }}
        transition={
          mode === 'scroll'
            ? { enterAnimation: 'fade-in', exitAnimation: 'fade-out', exitDuration: 360 }
            : undefined
        }
        scroll={{ zoneId: 'story' }}
      >
        <div style={{ ...stage, background: '#f2f2f3' }}>
          {/* First animation in the sequence */}
          <Animate animateId="headline" enterAnimation="fade-in" duration={{ enter: 800 }}>
            <h2>Scene 02 — cascade</h2>
          </Animate>

          {/* Second animation: waits for "headline" to finish

              In scroll mode: This means 800px of scroll for headline, then
              this starts. Total budget: 800 + 600 = 1400px.

              In drag mode: Plays after headline's 800ms duration finishes.

              Compare to manual approach:
              - CSS: Can't chain without JS
              - Framer Motion: Need useEffect + variants orchestration
              - GSAP Timeline: Imperative, harder to maintain
          */}
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

      {/* ─────────────────────────────────────────────────────────────────
          SCENE 3: Plain Content

          Not every scene needs animations. This one is just static content.
          Cineview doesn't force a mental model — mix animated and static freely.
      ───────────────────────────────────────────────────────────────── */}
      <Scene
        sceneId="outro"
        layout={{ width: '100%', height: '100vh', overflow: 'hidden' }}
        transition={
          mode === 'scroll'
            ? { enterAnimation: 'fade-in', exitAnimation: 'fade-out', exitDuration: 360 }
            : undefined
        }
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

      {/* ───────────────────────────────────────────────────────────────────
          WHY THE KEY PROP?

          Mode switching requires a full remount because the two engines have
          fundamentally different structures:
          - Drag: Gesture controller + viewport pager (like Swiper.js)
          - Scroll: Document flow + scrub zones (like ScrollTrigger)

          The literal branch split also keeps TypeScript happy — mode is a
          discriminated union, so mode="drag" and mode="scroll" accept
          different props and callbacks.
      ─────────────────────────────────────────────────────────────────── */}
      {mode === 'drag' ? (
        <Cineview key={mode} designWidth={750} mode="drag">
          {scenes.props.children}
        </Cineview>
      ) : (
        <Cineview key={mode} designWidth={750} mode="scroll">
          {scenes.props.children}
        </Cineview>
      )}
    </>
  );
}

/**
 * WHEN TO USE DRAG VS SCROLL?
 *
 * Use drag mode when:
 * - Mobile-first design (swipe feels native)
 * - Fixed number of "slides" (product tours, onboarding)
 * - User needs precise control (back/forward gestures)
 *
 * Use scroll mode when:
 * - Marketing pages (users expect scroll)
 * - Long-form content (many scenes, natural reading flow)
 * - Desktop-first (scroll wheel is primary input)
 *
 * Use BOTH when:
 * - You want mobile users to swipe, desktop users to scroll
 * - Solution: Detect touch capability and set mode accordingly
 *
 * ---
 *
 * NEXT STEPS:
 *
 * 1. Run this example: pnpm --dir examples/minimal dev
 * 2. Try the patterns: src/patterns/01-hello.tsx through 05-video.tsx
 * 3. Read the framework docs: https://cineview.pages.dev
 * 4. Check the full demo: https://cineview.pages.dev (site/ source code)
 */
