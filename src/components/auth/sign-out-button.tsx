'use client'

import {useRouter} from 'next/navigation'
import {useTranslations} from 'next-intl'
import * as React from 'react'

import {Button} from '@/components/ui/button'

type ApiResponse<T> =
  | {ok: true; data: T}
  | {ok: false; error: string}

type Props = {
  locale: string
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive'
  showError?: boolean
}

export function SignOutButton({locale, variant = 'outline', showError = true}: Props) {
  const t = useTranslations('Auth.signOut')
  const router = useRouter()

  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function signOut() {
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/auth/sign-out', {method: 'POST'})
      const json = (await res.json().catch(() => null)) as ApiResponse<unknown> | null

      if (!res.ok) {
        setError(json && 'error' in json ? json.error : t('genericError'))
        return
      }

      router.push(`/${locale}`)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button type="button" variant={variant} onClick={signOut} disabled={loading}>
        {t('button')}
      </Button>
      {showError && error ? <p className="text-sm text-destructive">{error}</p> : null}
    </>
  )
}
