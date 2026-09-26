export function parseAcceptanceRoute(hash: string): 'drag' | 'scroll' | null {
  const route = hash.replace(/^#/, '').replace(/\/+$/, '');
  if (route === '/acceptance/drag') return 'drag';
  if (route === '/acceptance/scroll') return 'scroll';
  return null;
}
