import {getTranslations} from 'next-intl/server'

export async function SiteFooter({locale}: {locale: string}) {
  const t = await getTranslations({locale, namespace: 'Common'})
  const year = new Date().getFullYear()

  return (
    <footer className="border-t">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm text-muted-foreground">{t('footerText', {year})}</p>
      </div>
    </footer>
  )
}
