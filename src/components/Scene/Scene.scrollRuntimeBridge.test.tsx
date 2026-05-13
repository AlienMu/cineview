import React, { useContext } from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Scene } from './Scene';
import { SceneContext, type SceneContextType } from '../Animate/Animate';

jest.mock('framer-motion', () => ({
  __esModule: true,
  motion: {
    div: (() => {
      const MotionDiv = React.forwardRef(
        (
          {
            children,
            onPanStart: _onPanStart,
            onPan: _onPan,
            onPanEnd: _onPanEnd,
            ...props
          }: React.PropsWithChildren<Record<string, unknown>>,
          ref: React.Ref<HTMLDivElement>
        ) => (
          <div ref={ref} {...props}>
            {children}
          </div>
        )
      );
      MotionDiv.displayName = 'MotionDiv';
      return MotionDiv;
    })(),
  },
  useAnimation: () => ({
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
    set: jest.fn(),
  }),
  useMotionValue: (initial: number) => ({
    get: () => initial,
    set: jest.fn(),
    on: () => () => undefined,
  }),
  animate: () => ({ stop: jest.fn() }),
}));

function RuntimeProbe(): JSX.Element {
  const sceneContext = useContext(SceneContext) as SceneContextType;
  return <div data-testid="runtime-state">{sceneContext.runtimeState}</div>;
}

describe('Scene scroll runtime bridge', () => {
  it('marks an incoming scroll scene as entering from runtime direction and progress', () => {
    render(
      <Scene
        mode="scroll"
        isActive={false}
        sceneIndex={1}
        totalScenes={3}
        currentSceneIndex={0}
        scrollRuntime={{
          progress: 0.4,
          isScrolling: true,
          direction: 'forward',
          transitionSnapshot: {
            fromScene: 0,
            toScene: 1,
            direction: 'forward',
            progressRatio: 0.4,
            startedAt: 0,
            lastInputAt: 0,
            isSettling: false,
            settleDirection: null,
          },
          backdropActive: false,
        }}
      >
        <RuntimeProbe />
      </Scene>
    );

    expect(screen.getByTestId('runtime-state')).toHaveTextContent('entering');
  });

  it('keeps a covered scroll backdrop scene out of pointer interaction', () => {
    const { container } = render(
      <Scene
        mode="scroll"
        isActive={false}
        sceneIndex={0}
        totalScenes={3}
        currentSceneIndex={1}
        stack={{ mode: 'cover' }}
        scrollRuntime={{
          progress: 0.5,
          isScrolling: true,
          direction: 'forward',
          transitionSnapshot: {
            fromScene: 1,
            toScene: 2,
            direction: 'forward',
            progressRatio: 0.5,
            startedAt: 0,
            lastInputAt: 0,
            isSettling: false,
            settleDirection: null,
          },
          backdropActive: true,
        }}
      >
        <RuntimeProbe />
      </Scene>
    );

    expect(screen.getByTestId('runtime-state')).toHaveTextContent('covered');
    expect(container.firstElementChild).toHaveStyle({ pointerEvents: 'none' });
  });
});
