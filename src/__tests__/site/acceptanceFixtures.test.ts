import { parseAcceptanceRoute } from '../../../site/src/acceptance/routing';

describe('production acceptance routes', () => {
  it.each(['drag', 'scroll'] as const)('opens the %s fixture', (mode) => {
    expect(parseAcceptanceRoute(`#/acceptance/${mode}`)).toBe(mode);
    expect(parseAcceptanceRoute(`#/acceptance/${mode}/`)).toBe(mode);
  });

  it.each(['', '#/', '#/drag', '#/does-not-exist', '#/acceptance/drag/unknown'])(
    'rejects unknown route %s instead of reporting a fallback as acceptance',
    (hash) => expect(parseAcceptanceRoute(hash)).toBeNull()
  );
});
