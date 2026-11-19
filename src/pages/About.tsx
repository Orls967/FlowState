import { useTranslation } from 'react-i18next';
import { PageHeader } from '../ui/PageHeader';

export default function About() {
  const { t } = useTranslation();
  return (
    <div>
      <PageHeader code="i" title={t('nav.about')} />
      <p className="p-6 text-ink-2">{t('app.comingSoon')}</p>
    </div>
  );
}
