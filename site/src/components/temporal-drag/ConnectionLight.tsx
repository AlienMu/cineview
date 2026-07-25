import { Animate } from 'cineview';
import { useTemporalMotion } from './TemporalMotion';

type ConnectionLightProps = {
  index: number;
  waitFor: string;
};

export function ConnectionLight({ index, waitFor }: ConnectionLightProps): JSX.Element {
  const timing = useTemporalMotion();

  return (
    <Animate
      animateId={`s03-light-${index}`}
      enterAnimation={{
        initial: { x: '-10%', opacity: 0, scale: 0 },
        animate: {
          x: '110%',
          opacity: [0, 1, 1, 0],
          scale: [0, 1, 1, 0.5],
          transition: { duration: timing.seconds(0.7), ease: 'linear' },
        },
      }}
      exitAnimation={{ exit: { opacity: 0, scale: 0 } }}
      duration={{ enter: timing.duration(700), exit: timing.duration(200) }}
      timeline={{ waitFor }}
    >
      <span className="s03-light" aria-hidden="true" />
    </Animate>
  );
}
