import { useEffect, useRef, useState } from 'react';
import { Animate } from 'cineview';
import { DragPhoneExperience } from './DragPhoneExperience';
import './DragPhoneScene.css';

function phoneRevealVariant(): {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
} {
  return {
    initial: { opacity: 0, scale: 0.84, filter: 'blur(18px)' },
    animate: { opacity: 1, scale: 1, filter: 'blur(0px)', transition: { duration: 0 } },
  };
}

function RevealedPhone({ progress }: { progress: number }): JSX.Element {
  const [unlocked, setUnlocked] = useState(false);
  const unlockedRef = useRef(false);

  useEffect(() => {
    if (!unlockedRef.current && progress >= 0.72) {
      unlockedRef.current = true;
      setUnlocked(true);
      return;
    }
    if (unlockedRef.current && progress <= 0.58) {
      unlockedRef.current = false;
      setUnlocked(false);
    }
  }, [progress]);

  return (
    <div
      className={`drag-phone-reveal${unlocked ? ' is-unlocked' : ''}`}
      data-drag-unlocked={unlocked ? 'true' : 'false'}
    >
      {unlocked ? <DragPhoneExperience embedded={true} /> : null}
    </div>
  );
}

export function DragPhoneScene(): JSX.Element {
  return (
    <div className="drag-phone-stage">
      <Animate
        animateId="drag-phone-reveal"
        enterAnimation={phoneRevealVariant()}
        duration={{ enter: 1800 }}
      >
        {({ enterProgress }) => <RevealedPhone progress={enterProgress} />}
      </Animate>
    </div>
  );
}
