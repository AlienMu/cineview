import React from 'react';

interface SceneNavigationProps {
  currentScene: number;
  totalScenes: number;
  onGoToScene: (index: number) => void;
  mode: 'snap' | 'drag' | 'scroll';
}

const SceneNavigation: React.FC<SceneNavigationProps> = ({
  currentScene,
  totalScenes,
  onGoToScene,
  mode,
}) => {
  const handlePrevious = () => {
    if (currentScene > 0) {
      onGoToScene(currentScene - 1);
    }
  };

  const handleNext = () => {
    if (currentScene < totalScenes - 1) {
      onGoToScene(currentScene + 1);
    }
  };

  const handleFirst = () => {
    onGoToScene(0);
  };

  const handleLast = () => {
    onGoToScene(totalScenes - 1);
  };

  return (
    <div
      className="scene-nav"
      style={{
        position: 'fixed',
        left: '20px',
        bottom: '20px',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 14px',
        background: 'rgba(10, 12, 18, 0.72)',
        border: '1px solid rgba(255,255,255,0.14)',
        borderRadius: '10px',
        backdropFilter: 'blur(14px)',
      }}
    >
      <button
        onClick={handleFirst}
        disabled={currentScene === 0}
        style={{
          background: 'transparent',
          border: 'none',
          color: currentScene === 0 ? '#666' : '#fff',
          cursor: currentScene === 0 ? 'not-allowed' : 'pointer',
          padding: '5px 10px',
          fontSize: '14px',
        }}
      >
        ⏮️ First
      </button>

      <button
        onClick={handlePrevious}
        disabled={currentScene === 0}
        style={{
          background: 'transparent',
          border: 'none',
          color: currentScene === 0 ? '#666' : '#fff',
          cursor: currentScene === 0 ? 'not-allowed' : 'pointer',
          padding: '5px 10px',
          fontSize: '14px',
        }}
      >
        ⬅️ Prev
      </button>

      <span style={{ margin: '0 12px', color: '#fff', minWidth: '130px', textAlign: 'center' }}>
        {currentScene + 1} / {totalScenes} ·{' '}
        {mode === 'snap' ? 'Snap' : mode === 'drag' ? 'Drag' : 'Scroll'}
      </span>

      <button
        onClick={handleNext}
        disabled={currentScene === totalScenes - 1}
        style={{
          background: 'transparent',
          border: 'none',
          color: currentScene === totalScenes - 1 ? '#666' : '#fff',
          cursor: currentScene === totalScenes - 1 ? 'not-allowed' : 'pointer',
          padding: '5px 10px',
          fontSize: '14px',
        }}
      >
        Next ➡️
      </button>

      <button
        onClick={handleLast}
        disabled={currentScene === totalScenes - 1}
        style={{
          background: 'transparent',
          border: 'none',
          color: currentScene === totalScenes - 1 ? '#666' : '#fff',
          cursor: currentScene === totalScenes - 1 ? 'not-allowed' : 'pointer',
          padding: '5px 10px',
          fontSize: '14px',
        }}
      >
        Last ⏭️
      </button>
    </div>
  );
};

export default SceneNavigation;
