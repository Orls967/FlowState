import { useTranslation } from 'react-i18next';
import { ABOUT } from '../content/about';
import { useSettings } from '../store/settings';
import { PageHeader } from '../ui/PageHeader';
import { RichText } from '../ui/RichText';

export default function About() {
  const { t } = useTranslation();
  const lang = useSettings((s) => s.lang);
  return (
    <div className="mx-auto w-full max-w-4xl pb-10">
      <PageHeader code="i" title={t('about.title')}>
        <p className="mt-2 inline-block border-2 border-accent px-2 py-1 text-sm font-semibold text-accent">
          {t('app.educational')}
        </p>
      </PageHeader>
      <div className="px-4 sm:px-6">
        {ABOUT.map((s) => (
          <section
            key={s.id}
            aria-labelledby={`about-${s.id}`}
            className="border-b-2 border-line py-6"
            data-testid={`about-${s.id}`}
          >
            <h2 id={`about-${s.id}`} className="font-display text-2xl font-semibold">
              {s.title[lang]}
            </h2>
            <RichText text={s.body[lang]} className="mt-2 max-w-3xl leading-relaxed" />
            {s.items.length > 0 && (
              <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {s.items.map((it) => (
                  <li key={it.title.en} className="border-l-2 border-line-strong pl-3">
                    <p className="font-semibold">{it.title[lang]}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-ink-2">{it.text[lang]}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
