import { useTranslation } from 'react-i18next';
import { PageHeader } from '../ui/PageHeader';

export default function LiveCity() {
  const { t } = useTranslation();
  return (
    <div>
      <PageHeader code="M1" title={t('nav.city')} />
      <p className="p-6 text-ink-2">{t('app.comingSoon')}</p>
    </div>
  );
}
