/**
 * Panda Bamboo — Drag Mode Demo (5 scenes)
 * Route: http://localhost:3000/#/panda
 */

import { Animate, Scene } from 'cineview';
import type { AnimationType } from 'cineview';

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------
const bg = (g: string) => ({ width: '100%', minHeight: '100%', background: g, overflow: 'hidden' });
const T = {
  title: (c = '#263238') => ({
    fontSize: 28,
    fontWeight: 800,
    color: c,
    textAlign: 'center' as const,
    margin: 0,
  }),
  sub: (c = '#8D6E63') => ({
    fontSize: 14,
    color: c,
    textAlign: 'center' as const,
    margin: 0,
    lineHeight: 1.6,
  }),
};
const card = {
  padding: '18px 20px',
  borderRadius: 18,
  background: 'rgba(255,255,255,0.92)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
  display: 'flex',
  alignItems: 'center',
  gap: 14,
};

// ---------------------------------------------------------------------------
// SVG Icons
// ---------------------------------------------------------------------------
function Panda({ size = 100, mood = 'happy' }: { size?: number; mood?: string }) {
  const m =
    mood === 'happy'
      ? 'M44 52 Q50 60 56 52'
      : mood === 'sleepy'
        ? 'M48 54 Q50 54 52 54'
        : 'M46 52 Q50 56 54 52';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <ellipse cx="22" cy="22" rx="16" ry="14" fill="#263238" />
      <ellipse cx="78" cy="22" rx="16" ry="14" fill="#263238" />
      <ellipse cx="22" cy="22" rx="10" ry="9" fill="#ECEFF1" />
      <ellipse cx="78" cy="22" rx="10" ry="9" fill="#ECEFF1" />
      <circle cx="50" cy="48" r="38" fill="#FAFAFA" stroke="#CFD8DC" strokeWidth="1.5" />
      <ellipse cx="32" cy="40" rx="14" ry="16" fill="#263238" transform="rotate(-8 32 40)" />
      <ellipse cx="68" cy="40" rx="14" ry="16" fill="#263238" transform="rotate(8 68 40)" />
      <circle cx="32" cy="40" r="5" fill="white" />
      <circle cx="68" cy="40" r="5" fill="white" />
      <circle cx="33" cy="39" r="2.5" fill="#263238" />
      <circle cx="67" cy="39" r="2.5" fill="#263238" />
      <ellipse cx="50" cy="48" rx="5" ry="3.5" fill="#263238" />
      <path d={m} stroke="#263238" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}
function Bamboo({ size = 50 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" fill="none">
      <rect x="26" y="4" width="8" height="52" rx="4" fill="#4CAF50" />
      <rect x="26" y="18" width="8" height="4" rx="2" fill="#388E3C" />
      <rect x="26" y="34" width="8" height="4" rx="2" fill="#388E3C" />
      <path
        d="M18 16 Q26 12 34 16"
        stroke="#8BC34A"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M16 38 Q26 32 36 38"
        stroke="#8BC34A"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
function Star({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
      <path
        d="M15 2L18.5 10.5L27 12L20.5 18.5L22 27L15 22.5L8 27L9.5 18.5L3 12L11.5 10.5Z"
        fill="#FFD54F"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Transition configs
// ---------------------------------------------------------------------------
const X: Array<{
  enter: AnimationType;
  exit: AnimationType;
  bgStr: string;
  tColor: string;
  sColor: string;
}> = [
  {
    enter: 'fade-in',
    exit: 'slide-up',
    bgStr: 'linear-gradient(180deg, #FFFBEB, #E8F5E9)',
    tColor: '#263238',
    sColor: '#8D6E63',
  },
  {
    enter: 'slide-right',
    exit: 'rotate-out',
    bgStr: 'linear-gradient(180deg, #E8F5E9, #C8E6C9)',
    tColor: '#1B5E20',
    sColor: '#8D6E63',
  },
  {
    enter: 'zoom-in',
    exit: 'slide-left',
    bgStr: 'linear-gradient(180deg, #C8E6C9, #FFF8E1)',
    tColor: '#33691E',
    sColor: '#8D6E63',
  },
  {
    enter: 'slide-left',
    exit: 'zoom-out',
    bgStr: 'linear-gradient(180deg, #A5D6A7, #E8F5E9)',
    tColor: '#1B5E20',
    sColor: '#8D6E63',
  },
  {
    enter: 'fade-in',
    exit: 'slide-up',
    bgStr: 'linear-gradient(180deg, #263238, #455A64)',
    tColor: '#ECEFF1',
    sColor: '#90A4AE',
  },
];

export const PandaDemoScenes: JSX.Element[] = [
  // ===== 1. DAWN =====
  <Scene
    key="0"
    transition={{ enterAnimation: X[0].enter, exitAnimation: X[0].exit, exitDuration: 900 }}
  >
    <div style={bg(X[0].bgStr)}>
      <div style={{ paddingTop: 150 }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Animate
            animateId="a1-1"
            enterAnimation="zoom-in"
            duration={{ enter: 700, exit: 400 }}
            infiniteAnimation="bounce"
          >
            <Panda size={130} mood="happy" />
          </Animate>
        </div>
        <div style={{ marginTop: 28 }}>
          <Animate
            animateId="a1-2"
            enterAnimation="slide-up"
            duration={{ enter: 550, exit: 300 }}
            waitFor="a1-1"
          >
            <h1 style={T.title(X[0].tColor)}>Good Morning</h1>
          </Animate>
        </div>
        <div style={{ marginTop: 10 }}>
          <Animate
            animateId="a1-3"
            enterAnimation="fade-in"
            duration={{ enter: 500, exit: 300 }}
            waitFor="a1-2"
          >
            <p style={T.sub(X[0].sColor)}>
              The bamboo forest wakes up.
              <br />
              Time to start a beautiful day.
            </p>
          </Animate>
        </div>
        <div
          style={{
            marginTop: 50,
            display: 'flex',
            justifyContent: 'space-around',
            padding: '0 50px',
          }}
        >
          <Animate
            animateId="a1-4"
            enterAnimation="slide-right"
            duration={{ enter: 550 }}
            delay={400}
          >
            <Bamboo size={55} />
          </Animate>
          <Animate
            animateId="a1-5"
            enterAnimation="slide-left"
            duration={{ enter: 550 }}
            delay={600}
          >
            <Bamboo size={45} />
          </Animate>
          <Animate
            animateId="a1-6"
            enterAnimation="slide-right"
            duration={{ enter: 550 }}
            delay={800}
          >
            <Bamboo size={50} />
          </Animate>
        </div>
        <div style={{ marginTop: 100, textAlign: 'center' }}>
          <Animate
            animateId="a1-7"
            enterAnimation="fade-in"
            duration={{ enter: 400 }}
            delay={1200}
            infiniteAnimation="pulse"
          >
            <span style={{ fontSize: 12, color: '#A5D6A7' }}>swipe up to continue ↑</span>
          </Animate>
        </div>
      </div>
    </div>
  </Scene>,

  // ===== 2. FEAST =====
  <Scene
    key="1"
    transition={{ enterAnimation: X[1].enter, exitAnimation: X[1].exit, exitDuration: 800 }}
  >
    <div style={bg(X[1].bgStr)}>
      <div style={{ paddingTop: 70 }}>
        <Animate animateId="a2-1" enterAnimation="slide-up" duration={{ enter: 500, exit: 300 }}>
          <h1 style={T.title('#1B5E20')}>Bamboo Feast 🎋</h1>
        </Animate>
        <div
          style={{
            marginTop: 36,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 22,
          }}
        >
          {[
            { emoji: '🎋', title: 'Fresh Bamboo', desc: 'Hand-picked from the morning grove.' },
            { emoji: '🍃', title: 'Green Leaves', desc: 'Nourished by mountain spring water.' },
            {
              emoji: '🍎',
              title: 'Forest Fruit',
              desc: 'Wild berries — a sweet treat after greens.',
            },
          ].map((c, i) => (
            <Animate
              key={i}
              animateId={`a2-${i + 2}`}
              enterAnimation={i === 0 ? 'slide-right' : i === 1 ? 'slide-left' : 'zoom-in'}
              duration={{ enter: 650, exit: 350 }}
              delay={i === 0 ? 200 : 0}
              waitFor={i > 0 ? `a2-${i + 1}` : undefined}
            >
              <div style={{ ...card, width: 300 }}>
                <span style={{ fontSize: 36 }}>{c.emoji}</span>
                <div>
                  <h3
                    style={{ fontSize: 16, fontWeight: 700, color: '#263238', margin: '0 0 4px' }}
                  >
                    {c.title}
                  </h3>
                  <p style={{ fontSize: 13, color: '#8D6E63', margin: 0 }}>{c.desc}</p>
                </div>
              </div>
            </Animate>
          ))}
        </div>
        <div style={{ marginTop: 36, display: 'flex', justifyContent: 'center' }}>
          <Animate
            animateId="a2-5"
            enterAnimation="fade-in"
            duration={{ enter: 500 }}
            delay={1600}
            infiniteAnimation="pulse"
          >
            <Panda size={80} mood="happy" />
          </Animate>
        </div>
      </div>
    </div>
  </Scene>,

  // ===== 3. GALLERY =====
  <Scene
    key="2"
    transition={{ enterAnimation: X[2].enter, exitAnimation: X[2].exit, exitDuration: 800 }}
  >
    <div style={bg(X[2].bgStr)}>
      <div style={{ paddingTop: 50 }}>
        <Animate animateId="a3-1" enterAnimation="fade-in" duration={{ enter: 400, exit: 300 }}>
          <h1 style={T.title('#33691E')}>Panda Gallery 📸</h1>
        </Animate>
        <div
          style={{
            marginTop: 36,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 18,
            padding: '0 30px',
            justifyItems: 'center',
          }}
        >
          {['🌿', '🌸', '🍀', '🌻'].map((p, i) => (
            <Animate
              key={i}
              animateId={`a3-${i + 2}`}
              enterAnimation={
                i === 0 ? 'zoom-in' : i === 1 ? 'slide-up' : i === 2 ? 'slide-right' : 'slide-left'
              }
              duration={{ enter: 650, exit: 350 }}
              delay={100 + i * 100}
            >
              <div
                style={{
                  width: 140,
                  height: 170,
                  borderRadius: 16,
                  background: 'white',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 56,
                }}
              >
                {p}
              </div>
            </Animate>
          ))}
        </div>
        <div style={{ marginTop: 36, textAlign: 'center', padding: '0 40px' }}>
          <Animate
            animateId="a3-6"
            enterAnimation="fade-in"
            duration={{ enter: 500, exit: 300 }}
            waitFor="a3-5"
          >
            <p style={T.sub()}>
              Every moment in the bamboo forest
              <br />
              is worth capturing.
            </p>
          </Animate>
        </div>
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
          <Animate
            animateId="a3-7"
            enterAnimation="fade-in"
            duration={{ enter: 400 }}
            delay={1600}
            infiniteAnimation="pulse"
          >
            <Panda size={60} mood="happy" />
          </Animate>
        </div>
      </div>
    </div>
  </Scene>,

  // ===== 4. ADVENTURE =====
  <Scene
    key="3"
    transition={{ enterAnimation: X[3].enter, exitAnimation: X[3].exit, exitDuration: 800 }}
  >
    <div style={bg(X[3].bgStr)}>
      <div style={{ paddingTop: 44 }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '0 30px' }}>
          {[1, 2, 3, 4].map((n) => (
            <Animate
              key={n}
              animateId={`a4-${n}`}
              enterAnimation="fade-in"
              duration={{ enter: 300, exit: 200 }}
              delay={n * 100}
              infiniteAnimation="pulse"
            >
              <Star size={24 + n * 3} />
            </Animate>
          ))}
        </div>
        <div style={{ marginTop: 56, display: 'flex', justifyContent: 'center' }}>
          <Animate
            animateId="a4-5"
            enterAnimation="zoom-in"
            duration={{ enter: 700, exit: 400 }}
            infiniteAnimation="pulse"
          >
            <div
              style={{
                padding: '24px 36px',
                borderRadius: 24,
                background: 'linear-gradient(135deg, #4CAF50, #8BC34A)',
                boxShadow: '0 8px 32px rgba(76,175,80,0.3)',
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: 20, fontWeight: 800, color: 'white', letterSpacing: 1 }}>
                Explore Now 🌏
              </span>
            </div>
          </Animate>
        </div>
        <div style={{ marginTop: 50, display: 'flex', justifyContent: 'center' }}>
          <Animate
            animateId="a4-6"
            enterAnimation="slide-up"
            duration={{ enter: 600, exit: 350 }}
            delay={400}
            infiniteAnimation="bounce"
          >
            <Panda size={100} mood="happy" />
          </Animate>
        </div>
        <div style={{ marginTop: 36, textAlign: 'center' }}>
          <Animate
            animateId="a4-7"
            enterAnimation="fade-in"
            duration={{ enter: 500, exit: 300 }}
            waitFor="a4-5"
          >
            <p
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: '#1B5E20',
                textAlign: 'center',
                margin: 0,
              }}
            >
              Adventure awaits beyond the grove.
            </p>
          </Animate>
        </div>
      </div>
    </div>
  </Scene>,

  // ===== 5. GOODNIGHT =====
  <Scene
    key="4"
    transition={{ enterAnimation: X[4].enter, exitAnimation: X[4].exit, exitDuration: 1200 }}
  >
    <div style={bg(X[4].bgStr)}>
      <div style={{ paddingTop: 50 }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '0 20px' }}>
          {['✨', '⭐', '🌟', '💫', '✨'].map((star, i) => (
            <Animate
              key={i}
              animateId={`a5-${i}`}
              enterAnimation="fade-in"
              duration={{ enter: 300 }}
              delay={i * 160}
              infiniteAnimation="pulse"
            >
              <span style={{ fontSize: 26 }}>{star}</span>
            </Animate>
          ))}
        </div>
        <div style={{ marginTop: 90, display: 'flex', justifyContent: 'center' }}>
          <Animate
            animateId="a5-5"
            enterAnimation="zoom-in"
            duration={{ enter: 800, exit: 500 }}
            infiniteAnimation="bounce"
          >
            <Panda size={140} mood="sleepy" />
          </Animate>
        </div>
        <div style={{ marginTop: 36, textAlign: 'center' }}>
          <Animate
            animateId="a5-6"
            enterAnimation="slide-up"
            duration={{ enter: 600, exit: 400 }}
            waitFor="a5-5"
          >
            <h1 style={T.title('#ECEFF1')}>Goodnight 🌙</h1>
          </Animate>
        </div>
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <Animate
            animateId="a5-7"
            enterAnimation="fade-in"
            duration={{ enter: 500, exit: 300 }}
            waitFor="a5-6"
          >
            <p
              style={{
                fontSize: 14,
                color: '#90A4AE',
                textAlign: 'center',
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              Drift into sweet bamboo dreams.
              <br />
              Tomorrow brings new adventures.
            </p>
          </Animate>
        </div>
        <div style={{ marginTop: 50, textAlign: 'center' }}>
          <Animate
            animateId="a5-8"
            enterAnimation="fade-in"
            duration={{ enter: 400 }}
            delay={2000}
            infiniteAnimation="pulse"
          >
            <span style={{ fontSize: 20, letterSpacing: 4, color: '#78909C' }}>Z z z</span>
          </Animate>
        </div>
      </div>
    </div>
  </Scene>,
];
