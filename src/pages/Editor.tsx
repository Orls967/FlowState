import { useTranslation } from 'react-i18next';
import { PageHeader } from '../ui/PageHeader';

export default function Editor() {
  const { t } = useTranslation();
  return (
    <div>
      <PageHeader code="M2" title={t('nav.editor')} />
      <p className="p-6 text-ink-2">{t('app.comingSoon')}</p>
    </div>
  );
}
