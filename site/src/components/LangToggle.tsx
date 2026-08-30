import { useI18n } from '../i18n';

/**
 * 浮动语言切换 — 一个地球图标 + 当前可切到的语言短码。
 *
 * 挂载点由**调用方**决定，本组件不再自己嗅探路由：
 * - 普通页面（Home / Demo）各自挂在页面右上角，用 `.lang-toggle` 默认定位；
 * - `/docs` 由 `DocsShell` 挂在应用栏内（`variant="shell"`：静态定位、跟随栏内布局），
 *   App 层已把 `/docs` 排除在全局挂载之外，否则会渲染两个切换器；
 * - `/drag` 由 act1 的 `<Scene>` 内部挂载并包一层 `<Animate>`（见 SceneRolling
 *   的 GatedLangToggle），因此它跟随拖拽时间轴进退场，而不是浮在五幕之上。
 *   该场景用 `.s01-lang-slot` 承担定位，`variant` 只负责配色。
 */
export function LangToggle({ variant }: { variant?: 'drag' | 'shell' } = {}): JSX.Element {
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
