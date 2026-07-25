import { memo } from 'react';

const TIMECODES = Array.from({ length: 20 }, (_, index) => {
  const seconds = 1 + Math.floor(index / 12);
  const frames = (index * 3) % 25;
  return `00:00:${String(seconds).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
});

function StreamColumn({ position }: { position: 'left' | 'center' | 'right' }): JSX.Element {
  const items = [...TIMECODES, ...TIMECODES];

  return (
    <div className={`s03-stream s03-stream--${position}`} aria-hidden="true">
      {items.map((timecode, index) => (
        <span key={`${position}-${index}`}>{timecode}</span>
      ))}
    </div>
  );
}

export const TimeStreams = memo(function TimeStreams(): JSX.Element {
  return (
    <div className="s03-streams" aria-hidden="true">
      <StreamColumn position="left" />
      <StreamColumn position="center" />
      <StreamColumn position="right" />
    </div>
  );
});
