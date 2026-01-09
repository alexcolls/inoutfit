import {z} from 'zod'

import {falSubscribe} from '@/lib/fal/run'
import {withRequestLogging} from '@/lib/http/logger'
import {fail, ok} from '@/lib/http/response'
import {loadPromptConfig} from '@/lib/prompts/load'
import {GALLERY_BUCKET, USERS_BUCKET} from '@/lib/storage/buckets'
import {createSupabaseAdminClient} from '@/lib/supabase/admin'
import {createRouteSupabaseClient} from '@/lib/supabase/route'

export const runtime = 'nodejs'

const schema = z.object({
  // Original avatar path (optional; used only for a better description placeholder).
  avatarPath: z.string().min(1).optional(),
  // Base model image to use as reference (either gallery avatar or users output).
  baseModelPath: z.string().min(1),
  // Which photoshoot prompt to run.
  shot: z.number().int().min(1).max(3),
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

export const POST = withRequestLogging('clothes.photoshoot.post', async (request: Request) => {
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

  const uid = userData.user.id
  const {avatarPath, baseModelPath, shot} = parsed.data

  if (avatarPath && !avatarPath.startsWith('avatars/')) {
    return fail(400, 'Invalid avatarPath')
  }

  // Allow reference images from either gallery avatars or the user's own outputs.
  if (!(baseModelPath.startsWith('avatars/') || baseModelPath.startsWith(`${uid}/outputs/`))) {
    return fail(403, 'Forbidden')
  }

  const admin = createSupabaseAdminClient()

  const baseBucket = baseModelPath.startsWith('avatars/') ? GALLERY_BUCKET : USERS_BUCKET

  const {data: baseSigned, error: baseSignError} = await admin.storage
    .from(baseBucket)
    .createSignedUrl(baseModelPath, 60 * 10)

  const baseSignedUrl = baseSigned?.signedUrl ?? null
  if (baseSignError || !baseSignedUrl) {
    return fail(400, baseSignError?.message ?? 'Failed to access base model image')
  }

  const {data: avatarSigned, error: avatarSignError} = avatarPath
    ? await admin.storage.from(GALLERY_BUCKET).createSignedUrl(avatarPath, 60 * 10)
    : {data: null, error: null}

  const avatarSignedUrl = avatarSigned?.signedUrl ?? null
  if (avatarPath && (avatarSignError || !avatarSignedUrl)) {
    return fail(400, avatarSignError?.message ?? 'Failed to access avatar')
  }

  const avatarDescription = avatarPath
    ? normalizeAvatarDescription(avatarPath)
    : normalizeAvatarDescription(baseModelPath)

  const promptByShot: Record<number, string> = {
    1: 'photoshoot-1-studio-front.yaml',
    2: 'photoshoot-2-angled-lookbook.yaml',
    3: 'photoshoot-3-editorial-pose.yaml',
  }

  const promptFile = promptByShot[shot]
  if (!promptFile) {
    return fail(400, 'Invalid shot')
  }

  try {
    const {model, prompt} = await loadPromptConfig(promptFile)
    const renderedPrompt = prompt.replaceAll('[AVATAR_DESCRIPTION]', avatarDescription)

    const image_urls = avatarSignedUrl ? [avatarSignedUrl, baseSignedUrl] : [baseSignedUrl]

    const falRaw = await falSubscribe(model, {
      prompt: renderedPrompt,
      image_urls,
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

    const outPath = `${uid}/outputs/photoshoot/${Date.now()}-${shot}.${ext}`

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
      shot,
      image: {
        path: outPath,
        signedUrl: signed.signedUrl,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to generate photoshoot image'
    return fail(400, msg)
  }
})
