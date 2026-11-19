import { useTranslation } from 'react-i18next';
import { PageHeader } from '../ui/PageHeader';

export default function Transit() {
  const { t } = useTranslation();
  return (
    <div>
      <PageHeader code="M4" title={t('nav.transit')} />
      <p className="p-6 text-ink-2">{t('app.comingSoon')}</p>
    </div>
  );
}
