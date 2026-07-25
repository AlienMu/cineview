import { afterAll } from 'vitest';

const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;
const unexpectedConsoleMessages: string[] = [];

function capture(level: 'warn' | 'error', args: unknown[]): void {
  unexpectedConsoleMessages.push(
    `${level}: ${args
      .map((value) => {
        if (typeof value === 'string') return value;
        try {
          return JSON.stringify(value);
        } catch {
          return String(value);
        }
      })
      .join(' ')}`
  );
}

console.warn = (...args: unknown[]): void => capture('warn', args);
console.error = (...args: unknown[]): void => capture('error', args);

afterAll(() => {
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;

  if (unexpectedConsoleMessages.length > 0) {
    throw new Error(
      `Unexpected console output:\n${unexpectedConsoleMessages.slice(0, 10).join('\n')}`
    );
  }
});
