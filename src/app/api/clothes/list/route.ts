import {withRequestLogging} from '@/lib/http/logger'
import {fail, ok} from '@/lib/http/response'
import {USERS_BUCKET} from '@/lib/storage/buckets'
import {createSupabaseAdminClient} from '@/lib/supabase/admin'
import {createRouteSupabaseClient} from '@/lib/supabase/route'

export const runtime = 'nodejs'

export const GET = withRequestLogging('clothes.list.get', async () => {
  const supabase = await createRouteSupabaseClient()
  const {data: userData, error: userError} = await supabase.auth.getUser()

  if (userError || !userData.user) {
    return fail(401, 'Unauthorized')
  }

  const userId = userData.user.id
  const admin = createSupabaseAdminClient()

  const root = `${userId}/clothes`

  const {data: entries, error} = await admin.storage.from(USERS_BUCKET).list(root, {
    limit: 200,
    offset: 0,
    sortBy: {column: 'name', order: 'asc'}
  })

  if (error) {
    return fail(400, error.message)
  }

  const types = (entries ?? [])
    .filter((e) => {
      const id = (e as {id?: unknown}).id
      return !(typeof id === 'string' && id.length > 0)
    }) // folders typically have no id
    .map((e) => e.name)
    .filter(Boolean)

  const groups = await Promise.all(
    types.map(async (type) => {
      const folder = `${root}/${type}`
      const {data: files} = await admin.storage.from(USERS_BUCKET).list(folder, {
        limit: 200,
        offset: 0,
        sortBy: {column: 'name', order: 'desc'}
      })

      const realFiles = (files ?? []).filter((f) => {
        const id = (f as {id?: unknown}).id
        return (typeof id === 'string' && id.length > 0) || (f.name ?? '').includes('.')
      })

      const items = await Promise.all(
        realFiles.map(async (f) => {
          const path = `${folder}/${f.name}`
          const {data: signed} = await admin.storage
            .from(USERS_BUCKET)
            .createSignedUrl(path, 60 * 10)

          return {
            name: f.name,
            path,
            signedUrl: signed?.signedUrl ?? null,
          }
        })
      )

      return {
        type,
        items: items.filter((i) => Boolean(i.signedUrl)),
      }
    })
  )

  // Sort groups by type for stable UI
  groups.sort((a, b) => a.type.localeCompare(b.type))

  return ok({groups})
})
