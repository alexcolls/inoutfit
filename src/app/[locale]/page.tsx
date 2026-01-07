import Link from 'next/link'
import {getTranslations, setRequestLocale} from 'next-intl/server'

import {Button} from '@/components/ui/button'

type Props = {
  params: Promise<{locale: string}>
}

export default async function HomePage({params}: Props) {
  const {locale} = await params
  setRequestLocale(locale)

  const t = await getTranslations({locale, namespace: 'Home'})
  const c = await getTranslations({locale, namespace: 'Common'})

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="mt-8">
        <Button asChild>
          <Link href={`/${locale}/creations/new`}>{c('newCreation')}</Link>
        </Button>
      </div>

      <section className="mt-10 rounded-xl border bg-card p-6 text-card-foreground">
        <p className="text-sm">
          Next steps: we’ll add outfit uploads, the model gallery, and fal.ai generation flows.
        </p>
      </section>
    </main>
  )
}
