import {Suspense} from 'react'

import {SignUpForm} from '@/components/auth/sign-up-form'

type Props = {
  params: Promise<{locale: string}>
}

export default async function SignUpPage({params}: Props) {
  const {locale} = await params

  return (
    <Suspense>
      <SignUpForm locale={locale} />
    </Suspense>
  )
}
