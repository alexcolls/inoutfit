import {withRequestLogging} from '@/lib/http/logger'
import {fail, ok} from '@/lib/http/response'
import {GALLERY_BUCKET} from '@/lib/storage/buckets'
import {createSupabaseAdminClient} from '@/lib/supabase/admin'
import {createRouteSupabaseClient} from '@/lib/supabase/route'

export const runtime = 'nodejs'

const FOLDER = 'avatars'

export const GET = withRequestLogging('gallery.avatars.get', async () => {
  const supabase = await createRouteSupabaseClient()
  const {data: userData, error: userError} = await supabase.auth.getUser()

  if (userError || !userData.user) {
    return fail(401, 'Unauthorized')
  }

  const admin = createSupabaseAdminClient()

  const {data: objects, error} = await admin.storage.from(GALLERY_BUCKET).list(FOLDER, {
    limit: 200,
    offset: 0,
    sortBy: {column: 'name', order: 'asc'}
  })

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('bucket') && msg.includes('not found')) {
      return ok({
        items: [],
        warning: `Storage bucket "${GALLERY_BUCKET}" not found. Create it and upload images under ${FOLDER}/.`
      })
    }

    return fail(400, error.message)
  }

  // `list()` may return folder-like entries; filter to likely files.
  const files = (objects ?? []).filter((o) => {
    const anyO = o as unknown as {id?: string | null; metadata?: unknown; name?: string}
    if (anyO.id) return true
    if (anyO.metadata) return true
    if (typeof anyO.name === 'string' && anyO.name.includes('.')) return true
    return false
  })

  const signed = await Promise.all(
    files.map(async (o) => {
      const path = `${FOLDER}/${o.name}`
      const {data, error: signError} = await admin.storage
        .from(GALLERY_BUCKET)
        .createSignedUrl(path, 60 * 10)

      if (signError || !data?.signedUrl) {
        return null
      }

      return {
        name: o.name,
        path,
        signedUrl: data.signedUrl
      }
    })
  )

  return ok({items: signed.filter(Boolean)})
})