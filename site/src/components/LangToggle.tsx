import { useI18n } from '../i18n';

/** Language toggle: a globe icon and the language to switch to. The docs shell mounts it in the bar. */
export function LangToggle({
  variant,
}: { variant?: 'drag' | 'shell' } = {}): import('react').JSX.Element {
  const { t, lang, toggleLang } = useI18n();

  return (
    <button
      type="button"
      className={variant ? `lang-toggle lang-toggle--${variant}` : 'lang-toggle'}
      onClick={toggleLang}
      aria-label={t('nav.langLabel')}
      title={t('nav.langLabel')}
    >
      <svg
        className="lang-toggle__globe"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3c2.5 2.5 3.8 5.7 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.7-3.8-9s1.3-6.5 3.8-9z" />
      </svg>
      <span className="lang-toggle__code mono">{lang === 'zh' ? 'EN' : 'ZH'}</span>
    </button>
  );
}
