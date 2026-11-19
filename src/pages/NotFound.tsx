import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="p-8">
      <p className="font-display text-2xl">404</p>
      <p className="mt-2 text-ink-2">{t('errors.notFound')}</p>
      <Link to="/" className="mt-4 inline-block underline">
        {t('nav.home')}
      </Link>
    </div>
  );
}
