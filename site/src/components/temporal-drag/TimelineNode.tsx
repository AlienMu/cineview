import { Animate, useAnimateTimeline } from 'cineview';
import { useEffect, useRef, useState } from 'react';
import { useMotionValueEvent } from 'framer-motion';
import { useTemporalMotion } from './TemporalMotion';

type TimelineNodeProps = {
  id: string;
  glyph: string;
  label: string;
  waitFor: string;
  delay?: number;
  exitDuration: number;
  index: number;
  isCurrent: boolean;
  onEntered: (index: number) => void;
};

function TimelineNodeContent({
  glyph,
  label,
  index,
  isCurrent,
  onEntered,
}: Pick<TimelineNodeProps, 'glyph' | 'label' | 'index' | 'isCurrent' | 'onEntered'>): JSX.Element {
  const timeline = useAnimateTimeline();
  const [active, setActive] = useState(timeline.phase.get() === 'entered');
  const notifiedRef = useRef(false);

  const applyPhase = (phase: string): void => {
    const entered = phase === 'entered';
    setActive((current) => (current === entered ? current : entered));
    if (entered && !notifiedRef.current) {
      notifiedRef.current = true;
      onEntered(index);
    }
    if (!entered) notifiedRef.current = false;
  };

  useMotionValueEvent(timeline.phase, 'change', applyPhase);
  useEffect(() => applyPhase(timeline.phase.get()), [timeline.phase]);

  // is-active = entered (amber baseline, 编排就位); is-current = the single
  // node matching the panel's ACTIVE CUE (magenta 点睛, v3 §6.99).
  const cls = `s03-node${active ? ' is-active' : ''}${active && isCurrent ? ' is-current' : ''}`;

  return (
    <div className={cls} data-node-index={index}>
      <span className="s03-node__glyph">{glyph}</span>
      <span className="s03-node__label">{label}</span>
    </div>
  );
}

export function TimelineNode({
  id,
  glyph,
  label,
  waitFor,
  delay = 0,
  exitDuration,
  index,
  isCurrent,
  onEntered,
}: TimelineNodeProps): JSX.Element {
  const timing = useTemporalMotion();

  return (
    <Animate
      animateId={id}
      enterAnimation="bounce-in"
      exitAnimation={{ exit: { scale: 0, opacity: 0 } }}
      duration={{ enter: timing.duration(500), exit: timing.duration(exitDuration) }}
      timeline={{ waitFor, delay: timing.delay(delay) }}
    >
      <TimelineNodeContent
        glyph={glyph}
        label={label}
        index={index}
        isCurrent={isCurrent}
        onEntered={onEntered}
      />
    </Animate>
  );
}
