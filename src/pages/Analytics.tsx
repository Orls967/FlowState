import { useTranslation } from 'react-i18next';
import { PageHeader } from '../ui/PageHeader';

export default function Analytics() {
  const { t } = useTranslation();
  return (
    <div>
      <PageHeader code="M5" title={t('nav.analytics')} />
      <p className="p-6 text-ink-2">{t('app.comingSoon')}</p>
    </div>
  );
}
