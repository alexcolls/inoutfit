'use client'

import {LanguagesIcon} from 'lucide-react'
import {usePathname, useRouter, useSearchParams} from 'next/navigation'
import {useTranslations} from 'next-intl'

import {Button} from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type Props = {
  locale: 'en' | 'es' | string
}

function replaceLocaleInPath(pathname: string, nextLocale: string) {
  // Expected routes: /[locale]/...
  const replaced = pathname.replace(/^\/(en|es)(?=\/|$)/, `/${nextLocale}`)
  if (replaced === pathname) {
    return `/${nextLocale}`
  }
  return replaced
}

export function LocaleSwitcher({locale}: Props) {
  const t = useTranslations('Common')

  const router = useRouter()
  const pathname = usePathname() ?? '/'
  const searchParams = useSearchParams()

  function go(nextLocale: 'en' | 'es') {
    const path = replaceLocaleInPath(pathname, nextLocale)
    const qs = searchParams.toString()
    router.push(qs ? `${path}?${qs}` : path)
    router.refresh()
  }

  const current = locale === 'es' ? 'ES' : 'EN'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label={t('language')}>
          <LanguagesIcon className="size-4" />
          <span className="sr-only">{t('language')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            go('en')
          }}
        >
          {t('english')}
          {current === 'EN' ? <span className="ml-auto text-xs">✓</span> : null}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            go('es')
          }}
        >
          {t('spanish')}
          {current === 'ES' ? <span className="ml-auto text-xs">✓</span> : null}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
