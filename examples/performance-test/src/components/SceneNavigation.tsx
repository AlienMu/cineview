import type { CSSProperties } from 'react';
import type { ModeId } from '../routing';
import { buildModeHref, MODE_ROUTES } from '../routing';

interface SceneNavigationProps {
  currentScene: number;
  mode: ModeId;
  onGoToScene: (index: number) => void;
  totalScenes: number;
}

export default function SceneNavigation({
  currentScene,
  mode,
  onGoToScene,
  totalScenes,
}: SceneNavigationProps): JSX.Element {
  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 18,
        transform: 'translateX(-50%)',
        zIndex: 12000,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        padding: '12px 14px',
        borderRadius: 8,
        background: 'rgba(255,255,255,0.82)',
        border: '1px solid rgba(100, 124, 170, 0.16)',
        backdropFilter: 'blur(18px)',
        boxShadow: '0 18px 42px rgba(139, 165, 209, 0.18)',
        width: 'min(960px, calc(100vw - 36px))',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <a href="#/" style={linkStyle}>
          Hub
        </a>
        {MODE_ROUTES.map((route) => (
          <a
            key={route.id}
            href={buildModeHref(route.id)}
            style={{
              ...linkStyle,
              background: route.id === mode ? 'rgba(112, 168, 255, 0.18)' : 'transparent',
              borderColor: route.id === mode ? 'rgba(112, 168, 255, 0.34)' : 'rgba(100, 124, 170, 0.16)',
              color: route.id === mode ? '#2F60C9' : '#4C5E84',
            }}
          >
            {route.label}
          </a>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => onGoToScene(Math.max(currentScene - 1, 0))}
          disabled={currentScene === 0}
          style={buttonStyle(currentScene === 0)}
        >
          Previous
        </button>
        <div style={{ minWidth: 108, textAlign: 'center', color: '#40527A', fontSize: 13 }}>
          {currentScene + 1} / {totalScenes}
        </div>
        <button
          onClick={() => onGoToScene(Math.min(currentScene + 1, totalScenes - 1))}
          disabled={currentScene === totalScenes - 1}
          style={buttonStyle(currentScene === totalScenes - 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

const linkStyle: CSSProperties = {
  border: '1px solid rgba(100, 124, 170, 0.16)',
  borderRadius: 999,
  padding: '8px 12px',
  color: '#4C5E84',
  fontSize: 13,
  textDecoration: 'none',
};

function buttonStyle(disabled: boolean): CSSProperties {
  return {
    border: '1px solid rgba(100, 124, 170, 0.16)',
    borderRadius: 999,
    padding: '8px 14px',
    background: disabled ? 'rgba(228, 236, 248, 0.72)' : 'rgba(255,255,255,0.92)',
    color: disabled ? '#A3B1CC' : '#3A4D76',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 13,
  };
}
