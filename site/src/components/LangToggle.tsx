import { useI18n } from '../i18n';

/**
 * 右上角浮动语言切换 — 唯一常驻 chrome（取消了顶栏，见 task-flow 阶段1变更）。
 * 一个地球图标 + 当前可切到的语言短码。GitHub/导航全部下放到页内。
 */
export function LangToggle(): JSX.Element {
  const { t, lang, toggleLang } = useI18n();

  return (
    <button
      type="button"
      className="lang-toggle"
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
      <span className="lang-toggle__code mono">{lang === 'zh' ? 'EN' : '中'}</span>
    </button>
  );
}
