import {getTranslations, setRequestLocale} from 'next-intl/server';

import {ThemeToggle} from '@/components/theme-toggle';

type Props = {
  params: Promise<{locale: string}>;
};

export default async function HomePage({params}: Props) {
  const {locale} = await params;
  setRequestLocale(locale);

  const t = await getTranslations({locale, namespace: 'Home'});

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-10 px-6 py-12">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <ThemeToggle />
      </header>

      <section className="rounded-xl border bg-card p-6 text-card-foreground">
        <p className="text-sm">
          Next steps: we’ll add auth UI, outfit uploads, the model gallery, and fal.ai generation flows.
        </p>
      </section>
    </main>
  );
}
