import {z} from 'zod'

import {falSubscribe} from '@/lib/fal/run'
import {withRequestLogging} from '@/lib/http/logger'
import {fail, ok} from '@/lib/http/response'
import {loadPromptConfig} from '@/lib/prompts/load'
import {USERS_BUCKET} from '@/lib/storage/buckets'
import {createSupabaseAdminClient} from '@/lib/supabase/admin'
import {createRouteSupabaseClient} from '@/lib/supabase/route'

export const runtime = 'nodejs'

const schema = z.object({
  // Optional original avatar path, used for better description.
  avatarPath: z.string().min(1).optional(),
  // Start frame (expected: users/<uid>/outputs/...) 
  startPath: z.string().min(1),
  // End frame (expected: users/<uid>/outputs/...)
  endPath: z.string().min(1),
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

function extractVideoUrl(result: unknown): string | null {
  const rec = asRecord(result)
  const data = asRecord(rec ? rec.data : null)

  const video = (data?.video ?? rec?.video) as unknown
  const videoRec = asRecord(video)
  if (videoRec && typeof videoRec.url === 'string') return videoRec.url

  // Some models may return a raw string URL.
  if (typeof video === 'string') return video

  return null
}

function extFromContentType(ct: string | null) {
  const t = (ct ?? '').toLowerCase()
  if (t.includes('mp4')) return 'mp4'
  if (t.includes('webm')) return 'webm'
  return 'mp4'
}

export const POST = withRequestLogging('clothes.video.post', async (request: Request) => {
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
  const {avatarPath, startPath, endPath} = parsed.data

  if (avatarPath && !avatarPath.startsWith('avatars/')) {
    return fail(400, 'Invalid avatarPath')
  }

  // Restrict to user-owned outputs.
  const allowedPrefix = `${uid}/outputs/`
  if (!startPath.startsWith(allowedPrefix) || !endPath.startsWith(allowedPrefix)) {
    return fail(403, 'Forbidden')
  }

  const admin = createSupabaseAdminClient()

  const {data: startSigned, error: startSignError} = await admin.storage
    .from(USERS_BUCKET)
    .createSignedUrl(startPath, 60 * 10)

  const {data: endSigned, error: endSignError} = await admin.storage
    .from(USERS_BUCKET)
    .createSignedUrl(endPath, 60 * 10)

  const startSignedUrl = startSigned?.signedUrl ?? null
  const endSignedUrl = endSigned?.signedUrl ?? null

  if (startSignError || !startSignedUrl) {
    return fail(400, startSignError?.message ?? 'Failed to access start image')
  }

  if (endSignError || !endSignedUrl) {
    return fail(400, endSignError?.message ?? 'Failed to access end image')
  }

  const {model, prompt} = await loadPromptConfig('video-fashion-flow.yaml')

  const avatarDescription = avatarPath
    ? normalizeAvatarDescription(avatarPath)
    : normalizeAvatarDescription(startPath)

  const renderedPrompt = prompt.replaceAll('[AVATAR_DESCRIPTION]', avatarDescription)

  // Wan v2.2 image-to-video schema (see fal.ai model docs)
  const falRaw = await falSubscribe(model, {
    image_url: startSignedUrl,
    end_image_url: endSignedUrl,
    prompt: renderedPrompt,
    aspect_ratio: '9:16',
    resolution: '720p',
    frames_per_second: 16,
    num_frames: 81,
    acceleration: 'regular',
    enable_safety_checker: false,
    enable_output_safety_checker: false,
    enable_prompt_expansion: false,
    // Keep prompt adherence reasonable; defaults are fine but explicit is clearer.
    guidance_scale: 3.5,
    guidance_scale_2: 3.5,
    // Interpolation improves motion fluidity.
    interpolator_model: 'film',
    num_interpolated_frames: 1,
    adjust_fps_for_interpolation: true,
    video_quality: 'high',
    video_write_mode: 'balanced',
    negative_prompt:
      'blurry, low resolution, jitter, warping, artifacts, face morphing, identity change, different person, different face, different body, extra limbs, deformed hands, bad anatomy, text, watermark, logo, nudity, nsfw',
  })

  const outUrl = extractVideoUrl(falRaw)
  if (!outUrl) {
    return fail(400, 'Invalid AI response')
  }

  const res = await fetch(outUrl)
  if (!res.ok) {
    return fail(400, 'Failed to fetch AI output')
  }

  const bytes = new Uint8Array(await res.arrayBuffer())
  const ext = extFromContentType(res.headers.get('content-type'))

  const outPath = `${uid}/outputs/video/${Date.now()}.${ext}`

  const {error: uploadError} = await admin.storage.from(USERS_BUCKET).upload(outPath, bytes, {
    contentType: res.headers.get('content-type') ?? 'video/mp4',
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
