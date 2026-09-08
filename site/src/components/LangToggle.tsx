import { useI18n } from '../i18n';

/**
 * Floating language toggle — a globe icon + the current switchable language code.
 *
 * The mount point is determined by the **caller**, not by this component sniffing routes:
 * - Regular pages (Home / Demo) each mount in the top-right corner, using `.lang-toggle` default positioning;
 * - `/docs` is mounted by `DocsShell` inside the app bar (`variant="shell"`: static positioning, follows in-bar layout),
 *   the App layer has excluded `/docs` from global mounting, otherwise two toggles would render;
 * - `/drag` is mounted inside act1's `<Scene>` wrapped in an `<Animate>` (see SceneRolling's
 *   GatedLangToggle), so it enters/exits following the drag timeline, rather than floating above all five acts.
 *   That scene uses `.s01-lang-slot` for positioning, `variant` only handles coloring.
 */
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
