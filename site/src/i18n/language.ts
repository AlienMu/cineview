import type { Lang } from './types';

export const LANGUAGE_STORAGE_KEY = 'cineview-site-lang';

/** Reading the automatic default must never turn it into a saved user choice. */
export function resolveLanguage(): Lang {
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'zh' || saved === 'en') return saved;
  } catch {
    // Storage may be unavailable, including during server rendering.
  }

  const preferred =
    typeof navigator === 'undefined' ? '' : navigator.languages?.[0] || navigator.language;
  return /^zh(?:-|$)/i.test(preferred) ? 'zh' : 'en';
}

/** Call only for an explicit language-button action, never while applying copy. */
export function saveLanguage(lang: Lang): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // The current page can still switch when the choice cannot be persisted.
  }
}
