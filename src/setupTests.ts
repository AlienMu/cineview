import '@testing-library/jest-dom';
import { act } from '@testing-library/react';

// Expose React's `act` as a test global so specs can call it unqualified.
declare global {
  // eslint-disable-next-line no-var
  var act: typeof import('@testing-library/react').act;
}

(globalThis as unknown as { act: typeof act }).act = act;
