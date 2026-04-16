import React from 'react';

interface SceneNavigationProps {
  currentScene: number;
  totalScenes: number;
  onGoToScene: (index: number) => void;
}

const SceneNavigation: React.FC<SceneNavigationProps> = ({
  currentScene,
  totalScenes,
  onGoToScene,
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
    <div className="scene-nav">
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

      <span style={{ margin: '0 15px', color: '#fff' }}>
        {currentScene + 1} / {totalScenes}
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
