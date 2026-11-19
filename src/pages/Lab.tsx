import { useTranslation } from 'react-i18next';
import { PageHeader } from '../ui/PageHeader';

export default function Lab() {
  const { t } = useTranslation();
  return (
    <div>
      <PageHeader code="M3" title={t('nav.lab')} />
      <p className="p-6 text-ink-2">{t('app.comingSoon')}</p>
    </div>
  );
}
