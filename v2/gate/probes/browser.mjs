import { chromium, webkit } from 'playwright';

/**
 * Browser for the phase-1 probes: CV_ENGINE=chromium (default; Chrome, or the build at
 * CV_CHROMIUM), or webkit (Playwright WebKit).
 */
export const engine = process.env.CV_ENGINE ?? 'chromium';
if (!['chromium', 'webkit'].includes(engine)) {
  throw new Error(`Unknown browser engine: ${engine}`);
}

export function launch() {
  if (engine === 'webkit') return webkit.launch();
  return chromium.launch(
    process.env.CV_CHROMIUM ? { executablePath: process.env.CV_CHROMIUM } : { channel: 'chrome' }
  );
}
