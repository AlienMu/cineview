import { useEffect, useState } from 'react';
import type { AppRoute } from '../routing';
import { parseHashRoute } from '../routing';

function readCurrentRoute(): AppRoute {
  if (typeof window === 'undefined') {
    return 'home';
  }

  return parseHashRoute(window.location.hash);
}

export function useHashRoute(): AppRoute {
  const [route, setRoute] = useState<AppRoute>(readCurrentRoute);

  useEffect(() => {
    const onHashChange = () => setRoute(readCurrentRoute());

    window.addEventListener('hashchange', onHashChange);
    onHashChange();

    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return route;
}
