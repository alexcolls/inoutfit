import {Suspense} from 'react'

import {SignInForm} from '@/components/auth/sign-in-form'

type Props = {
  params: Promise<{locale: string}>
}

export default async function SignInPage({params}: Props) {
  const {locale} = await params

  return (
    <Suspense>
      <SignInForm locale={locale} />
    </Suspense>
  )
}
