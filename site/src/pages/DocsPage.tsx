import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

/** 阶段1 占位:阶段3 替换为 react-markdown 文档外壳(侧边栏 + 双语目录 + 锚点)。 */
export default function DocsPage(): JSX.Element {
  const { t } = useI18n();
  return (
    <main className="page-shell">
      <p className="eyebrow mono">{t('common.timecode')} · DOCS</p>
      <h1>{t('docs.title')}</h1>
      <p className="page-shell__lead">{t('idea.body')}</p>
      <Link to="/" className="btn btn--ghost">
        {t('demoHub.backHome')}
      </Link>
    </main>
  );
}
