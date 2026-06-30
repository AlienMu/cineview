import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

/** 阶段1 占位:阶段3 替换为双模式 Demo Hub(drag 全屏 / scroll 完整案例)。 */
export default function DemoPage(): JSX.Element {
  const { t } = useI18n();
  return (
    <main className="page-shell">
      <p className="eyebrow mono">{t('common.timecode')} · DEMO</p>
      <h1>{t('demoHub.title')}</h1>
      <p className="page-shell__lead">{t('demoHub.subtitle')}</p>
      <Link to="/" className="btn btn--ghost">
        {t('demoHub.backHome')}
      </Link>
    </main>
  );
}
