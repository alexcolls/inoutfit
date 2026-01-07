'use client'

import Link from 'next/link'
import {useRouter, useSearchParams} from 'next/navigation'
import {useTranslations} from 'next-intl'
import * as React from 'react'

import {AuthCard} from '@/components/auth/auth-card'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Separator} from '@/components/ui/separator'
import {safeNextPath} from '@/lib/http/redirect'

type ApiResponse<T> =
  | {ok: true; data: T}
  | {ok: false; error: string}

type Props = {
  locale: string
}

export function SignUpForm({locale}: Props) {
  const t = useTranslations('Auth.signUp')

  const router = useRouter()
  const searchParams = useSearchParams()

  const nextRaw = searchParams.get('next')
  const next = safeNextPath(nextRaw, `/${locale}`)

  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/auth/sign-up', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email, password}),
      })

      const json = (await res.json().catch(() => null)) as ApiResponse<unknown> | null

      if (!res.ok) {
        setError(json && 'error' in json ? json.error : t('genericError'))
        return
      }

      router.push(next)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  function startGoogleOAuth() {
    window.location.href = `/api/auth/oauth/google?next=${encodeURIComponent(next)}`
  }

  const signInHref = nextRaw ? `/${locale}/sign-in?next=${encodeURIComponent(nextRaw)}` : `/${locale}/sign-in`

  return (
    <AuthCard title={t('title')} description={t('description')}>
      <div className="space-y-4">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={startGoogleOAuth}
          disabled={loading}
        >
          {t('continueWithGoogle')}
        </Button>

        <div className="relative">
          <Separator />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="bg-card px-3 text-xs text-muted-foreground">{t('or')}</span>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('password')}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">{t('passwordHint')}</p>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t('submitting') : t('submit')}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground">
          {t('haveAccount')}{' '}
          <Link href={signInHref} className="text-foreground underline">
            {t('signInLink')}
          </Link>
        </p>
      </div>
    </AuthCard>
  )
}
