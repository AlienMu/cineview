import { useLayoutEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TemporalDragExperience } from '../components/temporal-drag';

export default function DragPage(): import('react').JSX.Element {
  // Homepage scene5 embedding protocol (task-flow 2026-08-02-scene5-cinema-entrance):
  // ?preload=true → warm up shell; ?deferred=true → dark shell waits for postMessage activation.
  // Direct access to /drag with no params sets both to false, behavior identical to pre-embedding.
  const [searchParams] = useSearchParams();

  useLayoutEffect(() => {
    // Only the full-screen drag route extends behind the device safe areas.
    // Restore the document when navigating back to ordinary scrolling pages.
    const root = document.documentElement;
    const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    const previousViewport = viewport?.getAttribute('content');
    root.classList.add('drag-document');
    viewport?.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover');
    return () => {
      root.classList.remove('drag-document');
      if (viewport) {
        if (previousViewport == null) viewport.removeAttribute('content');
        else viewport.setAttribute('content', previousViewport);
      }
    };
  }, []);

  return (
    <main className="drag-page" data-page="drag">
      <TemporalDragExperience
        preload={searchParams.get('preload') === 'true'}
        deferred={searchParams.get('deferred') === 'true'}
      />
    </main>
  );
}
