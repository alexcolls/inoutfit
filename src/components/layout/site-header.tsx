import Link from 'next/link'
import {getTranslations} from 'next-intl/server'

import {SignOutButton} from '@/components/auth/sign-out-button'
import {LocaleSwitcher} from '@/components/i18n/locale-switcher'
import {ThemeToggle} from '@/components/theme-toggle'
import {Button} from '@/components/ui/button'
import {createServerSupabaseClient} from '@/lib/supabase/server'

export async function SiteHeader({locale}: {locale: string}) {
  const t = await getTranslations({locale, namespace: 'Common'})

  const supabase = await createServerSupabaseClient()
  const {
    data: {user}
  } = await supabase.auth.getUser()

  return (
    <header className="border-b bg-background/70 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href={`/${locale}`} className="font-bold tracking-tight text-2xl">
          InOutfit
        </Link>

        <div className="flex items-center gap-2">


          {user ? (
            <>
              <Button asChild variant="outline">
                <Link href={`/${locale}/creations/new`}>{t('newCreation')}</Link>
              </Button>
              <SignOutButton locale={locale} variant="outline" showError={false} />
            </>
          ) : (
            <>
              <Button asChild variant="outline">
                <Link href={`/${locale}/sign-in`}>{t('signIn')}</Link>
              </Button>
              <Button asChild>
                <Link href={`/${locale}/sign-up`}>{t('signUp')}</Link>
              </Button>
            </>
          )}

          <LocaleSwitcher locale={locale} />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
