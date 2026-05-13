import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import DelayTest from './DelayTest';
import ScrollCapabilitiesShowcase from './ScrollCapabilitiesShowcase';
import ScrollShowcase from './ScrollShowcase';
import ScrollFixedShowcase from './ScrollFixedShowcase';
import ScrollTimelinePhaseProbe from './ScrollTimelinePhaseProbe';

// 通过 URL 参数选择测试模式
const params = new URLSearchParams(window.location.search);
const testMode = params.get('test');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {testMode === 'delay' ? (
      <DelayTest />
    ) : testMode === 'scroll' ? (
      <ScrollCapabilitiesShowcase />
    ) : testMode === 'scroll-legacy' ? (
      <ScrollShowcase />
    ) : testMode === 'scroll-fixed' ? (
      <ScrollFixedShowcase />
    ) : testMode === 'timeline-phase' ? (
      <ScrollTimelinePhaseProbe />
    ) : (
      <App />
    )}
  </React.StrictMode>
);
