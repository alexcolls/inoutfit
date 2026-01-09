import {z} from 'zod'

import {falSubscribe} from '@/lib/fal/run'
import {withRequestLogging} from '@/lib/http/logger'
import {fail, ok} from '@/lib/http/response'
import {loadPromptConfig} from '@/lib/prompts/load'
import {GALLERY_BUCKET, USERS_BUCKET} from '@/lib/storage/buckets'
import {createSupabaseAdminClient} from '@/lib/supabase/admin'
import {createRouteSupabaseClient} from '@/lib/supabase/route'

export const runtime = 'nodejs'

const schema = z
  .object({
    // Original avatar (used for prompt description; optional for backwards compatibility).
    avatarPath: z.string().min(1).optional(),
    // Base model image to edit (can be gallery avatar or a prior output in the users bucket).
    baseModelPath: z.string().min(1).optional(),
    clothesPath: z.string().min(1),
  })
  .refine((v) => Boolean(v.baseModelPath || v.avatarPath), {
    message: 'baseModelPath or avatarPath is required',
  })

function baseName(filename: string) {
  const last = filename.split('/').pop() ?? filename
  const idx = last.lastIndexOf('.')
  if (idx <= 0) return last
  return last.slice(0, idx)
}

function normalizeAvatarDescription(path: string) {
  return baseName(path).replace(/[-_]+/g, ' ').trim()
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
}

function extractFirstImageUrl(result: unknown): string | null {
  const rec = asRecord(result)
  const data = asRecord(rec ? rec.data : null)

  const images = (data?.images ?? rec?.images) as unknown
  if (Array.isArray(images) && images.length > 0) {
    const first = asRecord(images[0])
    if (first && typeof first.url === 'string') return first.url
  }

  const image = (data?.image ?? rec?.image) as unknown
  const imageRec = asRecord(image)
  if (imageRec && typeof imageRec.url === 'string') return imageRec.url

  return null
}

function extFromContentType(ct: string | null) {
  const t = (ct ?? '').toLowerCase()
  if (t.includes('jpeg') || t.includes('jpg')) return 'jpg'
  if (t.includes('png')) return 'png'
  if (t.includes('webp')) return 'webp'
  return 'jpg'
}

export const POST = withRequestLogging('clothes.wear.post', async (request: Request) => {
  const supabase = await createRouteSupabaseClient()
  const {data: userData, error: userError} = await supabase.auth.getUser()

  if (userError || !userData.user) {
    return fail(401, 'Unauthorized')
  }

  const json = await request.json().catch(() => null)
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    return fail(400, 'Invalid request body')
  }

  const {avatarPath, baseModelPath, clothesPath} = parsed.data

  if (avatarPath && !avatarPath.startsWith('avatars/')) {
    return fail(400, 'Invalid avatarPath')
  }

  const basePath = baseModelPath ?? avatarPath
  if (!basePath) {
    return fail(400, 'Invalid baseModelPath')
  }

  const uid = userData.user.id

  if (!(basePath.startsWith('avatars/') || basePath.startsWith(`${uid}/outputs/`))) {
    return fail(403, 'Forbidden')
  }

  const expectedPrefix = `${uid}/clothes/`
  if (!clothesPath.startsWith(expectedPrefix)) {
    return fail(403, 'Forbidden')
  }

  const parts = clothesPath.slice(expectedPrefix.length).split('/')
  const clothesType = parts[0]
  if (!clothesType) {
    return fail(400, 'Invalid clothesPath')
  }

  const admin = createSupabaseAdminClient()

  const baseBucket = basePath.startsWith('avatars/') ? GALLERY_BUCKET : USERS_BUCKET

  const {data: baseSigned, error: baseSignError} = await admin.storage
    .from(baseBucket)
    .createSignedUrl(basePath, 60 * 10)

  if (baseSignError || !baseSigned?.signedUrl) {
    return fail(400, baseSignError?.message ?? 'Failed to access base model image')
  }

  const {data: clothesSigned, error: clothesSignError} = await admin.storage
    .from(USERS_BUCKET)
    .createSignedUrl(clothesPath, 60 * 10)

  if (clothesSignError || !clothesSigned?.signedUrl) {
    return fail(400, clothesSignError?.message ?? 'Failed to access clothes')
  }

  const {model, prompt} = await loadPromptConfig('wear-model.yaml')

  const avatarDescription = avatarPath
    ? normalizeAvatarDescription(avatarPath)
    : normalizeAvatarDescription(basePath)

  const renderedPrompt = prompt
    .replaceAll('[AVATAR_DESCRIPTION]', avatarDescription)
    .replaceAll('[CLOTH_TYPE]', clothesType)

  // Schema for nano-banana-pro/edit requires prompt + image_urls.
  const falRaw = await falSubscribe(model, {
    prompt: renderedPrompt,
    image_urls: [baseSigned.signedUrl, clothesSigned.signedUrl],
    aspect_ratio: '9:16',
    output_format: 'jpeg',
    resolution: '1K',
  })

  const outUrl = extractFirstImageUrl(falRaw)
  if (!outUrl) {
    return fail(400, 'Invalid AI response')
  }

  const res = await fetch(outUrl)
  if (!res.ok) {
    return fail(400, 'Failed to fetch AI output')
  }

  const bytes = new Uint8Array(await res.arrayBuffer())
  const ext = extFromContentType(res.headers.get('content-type'))

  const outPath = `${uid}/outputs/wear/${Date.now()}.${ext}`

  const {error: uploadError} = await admin.storage.from(USERS_BUCKET).upload(outPath, bytes, {
    contentType: res.headers.get('content-type') ?? 'image/jpeg',
    upsert: false,
  })

  if (uploadError) {
    return fail(400, uploadError.message)
  }

  const {data: signed, error: signError} = await admin.storage
    .from(USERS_BUCKET)
    .createSignedUrl(outPath, 60 * 10)

  if (signError || !signed?.signedUrl) {
    return fail(400, signError?.message ?? 'Failed to sign output URL')
  }

  return ok({
    path: outPath,
    signedUrl: signed.signedUrl,
  })
})
