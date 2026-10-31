import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { en } from './en';
import { LANGUAGE_STORAGE_KEY, resolveLanguage, saveLanguage } from './language';
import type { Dict, DictKey, Lang } from './types';
import { zh } from './zh';

const DICTS: Record<Lang, Dict> = { zh, en };

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  t: (key: DictKey) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }): import('react').JSX.Element {
  const [lang, setLangState] = useState<Lang>(resolveLanguage);

  useEffect(() => {
    const syncLanguage = (event: StorageEvent): void => {
      if (event.key === LANGUAGE_STORAGE_KEY || event.key === null) {
        setLangState(resolveLanguage());
      }
    };
    window.addEventListener('storage', syncLanguage);
    return (): void => window.removeEventListener('storage', syncLanguage);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    saveLanguage(next);
    setLangState(next);
  }, []);
  const toggleLang = useCallback(() => setLang(lang === 'zh' ? 'en' : 'zh'), [lang, setLang]);

  const t = useCallback((key: DictKey): string => DICTS[lang][key] ?? DICTS.en[key] ?? key, [lang]);

  const value = useMemo<I18nContextValue>(
    () => ({ lang, setLang, toggleLang, t }),
    [lang, setLang, toggleLang, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

export type { Lang, DictKey } from './types';
