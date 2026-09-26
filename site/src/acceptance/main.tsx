import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AcceptanceDragPage from './AcceptanceDragPage';
import AcceptanceScrollPage from './AcceptanceScrollPage';
import { parseAcceptanceRoute } from './routing';

const route = parseAcceptanceRoute(window.location.hash);
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {route === 'drag' ? (
      <AcceptanceDragPage />
    ) : route === 'scroll' ? (
      <AcceptanceScrollPage />
    ) : (
      <p role="alert">Unknown acceptance route</p>
    )}
  </StrictMode>
);
