import { memo } from 'react';

type RecBadgeProps = {
  isRecording?: boolean;
};

export const RecBadge = memo(function RecBadge({ isRecording = true }: RecBadgeProps): JSX.Element {
  return (
    <span
      className={`tp-rec${isRecording ? ' is-recording' : ''}`}
      aria-label={isRecording ? 'Recording' : 'Stopped'}
    >
      <i className="tp-rec-dot" aria-hidden="true" />
      <span>REC</span>
    </span>
  );
});
