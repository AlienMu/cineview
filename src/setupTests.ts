import '@testing-library/jest-dom';
import { act } from '@testing-library/react';

// React 18 uses this flag to distinguish intentional test updates from runtime
// updates and avoid reporting false-positive act-environment warnings.
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

// Expose React's `act` as a test global so specs can call it unqualified.
declare global {
  // eslint-disable-next-line no-var
  var act: typeof import('@testing-library/react').act;
}

(globalThis as unknown as { act: typeof act }).act = act;

const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;
const unexpectedConsoleMessages: string[] = [];

function formatConsoleMessage(level: 'warn' | 'error', args: unknown[]): string {
  const message = args
    .map((value) => {
      if (typeof value === 'string') return value;
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    })
    .join(' ');
  return `${level}: ${message}`;
}

// Tests that intentionally exercise diagnostics should install their own
// console spy. Anything reaching these fallbacks is unexplained test output.
console.warn = (...args: unknown[]): void => {
  unexpectedConsoleMessages.push(formatConsoleMessage('warn', args));
};
console.error = (...args: unknown[]): void => {
  unexpectedConsoleMessages.push(formatConsoleMessage('error', args));
};

afterAll(() => {
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;

  if (unexpectedConsoleMessages.length > 0) {
    throw new Error(
      `Unexpected console output:\n${unexpectedConsoleMessages.slice(0, 10).join('\n')}`
    );
  }
});
