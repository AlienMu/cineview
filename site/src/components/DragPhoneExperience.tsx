import { memo, useCallback, useEffect, useMemo, useRef, type PointerEvent } from 'react';
import { Animate, CineView, Scene } from 'cineview';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { useI18n } from '../i18n';
import './DragPhoneExperience.css';

type DragPhoneExperienceProps = {
  embedded?: boolean;
};

function identityVariant(): {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
} {
  return {
    initial: { opacity: 1 },
    animate: { opacity: 1, transition: { duration: 0 } },
  };
}

function stopNestedPointer(event: PointerEvent<HTMLDivElement>): void {
  // The inner drag Scene must finish its own pointer handler first, then keep
  // the outer scroll CineView from interpreting the same gesture.
  event.stopPropagation();
}

function DragTrack({ progress }: { progress: MotionValue<number> }): JSX.Element {
  const renderScale = useTransform(progress, [0, 1], [0, 1]);
  const renderOffset = useTransform(progress, [0, 1], ['0%', '100%']);

  return (
    <div className="drag-phone__tracks" aria-hidden="true">
      <div className="drag-phone__track-row">
        <span className="drag-phone__track-label mono">RENDER</span>
        <div className="drag-phone__track-line">
          <motion.span className="drag-phone__track-fill" style={{ scaleX: renderScale }} />
          <motion.span className="drag-phone__track-marker" style={{ left: renderOffset }} />
        </div>
      </div>
      <div className="drag-phone__track-row">
        <span className="drag-phone__track-label mono">ELEMENT</span>
        <div className="drag-phone__track-line drag-phone__track-line--element">
          <Animate
            animateId="drag-first-element-track"
            enterAnimation={identityVariant()}
            duration={{ enter: 1800 }}
          >
            {({ enterProgress }) => (
              <motion.span className="drag-phone__track-fill" style={{ scaleX: enterProgress }} />
            )}
          </Animate>
        </div>
      </div>
    </div>
  );
}

function FirstDragSceneContent({ progress }: { progress: MotionValue<number> }): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="drag-phone__scene-inner">
      <header className="drag-phone__header">
        <span className="drag-phone__rec mono">
          <i aria-hidden="true" /> REC
        </span>
        <span className="drag-phone__shot mono">{t('drag.shot')}</span>
      </header>

      <div className="drag-phone__center">
        <p className="drag-phone__eyebrow mono">{t('drag.eyebrow')}</p>
        <Animate animateId="drag-first-title" enterAnimation="fade-in" duration={{ enter: 640 }}>
          <h1 className="drag-phone__title">{t('drag.title')}</h1>
        </Animate>
        <Animate
          animateId="drag-first-sub"
          enterAnimation="slide-up"
          duration={{ enter: 700 }}
          timeline={{ waitFor: 'drag-first-title', delay: 80 }}
        >
          <p className="drag-phone__sub">{t('drag.sub')}</p>
        </Animate>
        <div className="drag-phone__frame-rule" aria-hidden="true" />
        <Animate
          animateId="drag-first-hint"
          enterAnimation="fade-in"
          duration={{ enter: 520 }}
          timeline={{ waitFor: 'drag-first-sub', delay: 140 }}
        >
          <p className="drag-phone__hint">
            <span className="drag-phone__hint-mark" aria-hidden="true">
              ↑↓
            </span>
            {t('drag.hint')}
          </p>
        </Animate>
      </div>

      <footer className="drag-phone__footer">
        <DragTrack progress={progress} />
        <span className="drag-phone__footer-note mono">{t('drag.footer')}</span>
      </footer>
    </div>
  );
}

function MinimalTargetContent(): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="drag-phone__target-inner">
      <span className="drag-phone__target-mark mono">CUT / 02</span>
      <p>{t('drag.target')}</p>
    </div>
  );
}

export const DragPhoneExperience = memo(function DragPhoneExperience({
  embedded = false,
}: DragPhoneExperienceProps): JSX.Element {
  const viewportRef = useRef<HTMLDivElement>(null);
  const progress = useMotionValue(0);
  const resetProgress = useCallback((): void => progress.set(0), [progress]);
  const callbacks = useMemo(
    () => ({
      onDragStart: resetProgress,
      onDragProgress: ({ progress: next }: { progress: number }): void => {
        progress.set(next);
      },
      onDragCancel: resetProgress,
      onDragCommit: resetProgress,
    }),
    [progress, resetProgress]
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const stopTouchBubble = (event: TouchEvent): void => event.stopPropagation();
    viewport.addEventListener('touchstart', stopTouchBubble, { passive: true });
    viewport.addEventListener('touchmove', stopTouchBubble, { passive: false });
    viewport.addEventListener('touchend', stopTouchBubble, { passive: true });
    viewport.addEventListener('touchcancel', stopTouchBubble, { passive: true });

    return (): void => {
      viewport.removeEventListener('touchstart', stopTouchBubble);
      viewport.removeEventListener('touchmove', stopTouchBubble);
      viewport.removeEventListener('touchend', stopTouchBubble);
      viewport.removeEventListener('touchcancel', stopTouchBubble);
    };
  }, []);

  return (
    <div
      ref={viewportRef}
      className={`drag-phone__viewport${embedded ? ' drag-phone__viewport--embedded' : ''}`}
      onPointerDown={stopNestedPointer}
      onPointerMove={stopNestedPointer}
      onPointerUp={stopNestedPointer}
      onPointerCancel={stopNestedPointer}
    >
      <CineView
        config={{ size: 390 }}
        mode="drag"
        modes={{
          drag: {
            direction: 'y',
            transitionDuration: 680,
            dragTimeScale: 12,
          },
        }}
        callbacks={callbacks}
      >
        <Scene
          sceneId="drag-first"
          className="drag-phone__scene drag-phone__scene--first"
          layout={{ width: '100%', height: '100%', overflow: 'hidden' }}
        >
          <FirstDragSceneContent progress={progress} />
        </Scene>
        <Scene
          sceneId="drag-target"
          className="drag-phone__scene drag-phone__scene--target"
          layout={{ width: '100%', height: '100%', overflow: 'hidden' }}
        >
          <MinimalTargetContent />
        </Scene>
      </CineView>
    </div>
  );
});
