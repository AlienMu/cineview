import { memo } from 'react';

type SprocketProps = {
  end?: boolean;
};

export const Sprocket = memo(function Sprocket({ end = false }: SprocketProps): JSX.Element {
  return <span className={`tp-sprocket${end ? ' tp-sprocket--end' : ''}`} aria-hidden="true" />;
});
