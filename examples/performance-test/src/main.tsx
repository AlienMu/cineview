import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

declare global {
  interface Window {
    __CINEVIEW_PROFILE__?: boolean;
    __CINEVIEW_PROBE__?: {
      reactCommits: number;
      reactCommitsByBoundary?: Record<string, number>;
      reactDurationMs: number;
    };
  }
}

const app = <App />;
const profiledApp = window.__CINEVIEW_PROFILE__ ? (
  <React.Profiler
    id="cineview-example"
    onRender={(_id, _phase, actualDuration) => {
      const probe = window.__CINEVIEW_PROBE__;
      if (probe) {
        probe.reactCommits += 1;
        probe.reactDurationMs += actualDuration;
      }
    }}
  >
    {app}
  </React.Profiler>
) : (
  app
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{profiledApp}</React.StrictMode>
);
