import { useSearchParams } from 'react-router-dom';
import { TemporalDragExperience } from '../components/temporal-drag';

export default function DragPage(): import('react').JSX.Element {
  // Homepage scene5 embedding protocol (task-flow 2026-08-02-scene5-cinema-entrance):
  // ?preload=true → warm up shell; ?deferred=true → dark shell waits for postMessage activation.
  // Direct access to /drag with no params sets both to false, behavior identical to pre-embedding.
  const [searchParams] = useSearchParams();

  return (
    <main className="drag-page" data-page="drag">
      <TemporalDragExperience
        preload={searchParams.get('preload') === 'true'}
        deferred={searchParams.get('deferred') === 'true'}
      />
    </main>
  );
}
