import {redirect} from 'next/navigation'
import {setRequestLocale} from 'next-intl/server'

import {CreationWizard} from '@/components/create/creation-wizard'
import {createServerSupabaseClient} from '@/lib/supabase/server'

type Props = {
  params: Promise<{locale: string}>
}

export default async function NewCreationPage({params}: Props) {
  const {locale} = await params
  setRequestLocale(locale)

  const supabase = await createServerSupabaseClient()
  const {
    data: {user}
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(
      `/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/creations/new`)}`
    )
  }

  return <CreationWizard locale={locale} />
}
