import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import viteConfig from '../vite.config';

function getCineviewAliasReplacement(): string | undefined {
  const alias = viteConfig.resolve?.alias;
  if (Array.isArray(alias)) {
    const match = alias.find((entry) => entry.find === 'cineview');
    return typeof match?.replacement === 'string' ? match.replacement : undefined;
  }

  if (alias && typeof alias === 'object' && 'cineview' in alias) {
    const replacement = alias.cineview;
    return typeof replacement === 'string' ? replacement : undefined;
  }

  return undefined;
}

describe('performance-test cineview resolution', () => {
  it('resolves cineview directly to the local source entry', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const expectedEntry = path.resolve(here, '../../../src/index.ts');

    expect(path.normalize(getCineviewAliasReplacement() ?? '')).toBe(path.normalize(expectedEntry));
  });

  it('keeps cineview out of optimizeDeps prebundling', () => {
    expect(viteConfig.optimizeDeps?.exclude).toContain('cineview');
  });

  it('dedupes shared runtime dependencies alongside the aliased source', () => {
    expect(viteConfig.resolve?.dedupe).toEqual(
      expect.arrayContaining(['react', 'react-dom', 'framer-motion'])
    );
  });
});
