import { useTranslation } from 'react-i18next';
import { PageHeader } from '../ui/PageHeader';

export default function Glossary() {
  const { t } = useTranslation();
  return (
    <div>
      <PageHeader code="M6" title={t('nav.glossary')} />
      <p className="p-6 text-ink-2">{t('app.comingSoon')}</p>
    </div>
  );
}
