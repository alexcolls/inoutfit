import {z} from 'zod'

import {withRequestLogging} from '@/lib/http/logger'
import {getRequestIp, rateLimitOrThrow} from '@/lib/http/rate-limit'
import {fail, ok} from '@/lib/http/response'
import {falSubscribe, falUpload} from '@/lib/fal/run'
import {loadPromptConfig} from '@/lib/prompts/load'
import {USERS_BUCKET} from '@/lib/storage/buckets'
import {createSupabaseAdminClient} from '@/lib/supabase/admin'
import {createRouteSupabaseClient} from '@/lib/supabase/route'

export const runtime = 'nodejs'

const allowedTypes = [
  't-shirt',
  'shirt',
  'sweater',
  'jacket',
  'coat',
  'pants',
  'shorts',
  'skirt',
  'dress',
  'hat',
  'shoes',
  'bag',
  'glasses',
] as const

type AllowedType = (typeof allowedTypes)[number]

const falResultSchema = z.object({
  response: z.boolean(),
  type: z.string(),
})

function safeExtension(file: File): string {
  const name = file.name || ''
  const idx = name.lastIndexOf('.')
  const ext = idx >= 0 ? name.slice(idx + 1).toLowerCase() : ''
  if (ext && /^[a-z0-9]{1,8}$/.test(ext)) return ext

  const t = (file.type || '').toLowerCase()
  if (t.includes('jpeg') || t.includes('jpg')) return 'jpg'
  if (t.includes('png')) return 'png'
  if (t.includes('webp')) return 'webp'
  return 'jpg'
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
}

function stripCodeFences(s: string) {
  const trimmed = s.trim()
  if (!trimmed.startsWith('```')) return trimmed
  // Remove leading/trailing fences and optional language tag.
  return trimmed
    .replace(/^```[a-zA-Z0-9_-]*\n/, '')
    .replace(/\n```$/, '')
    .trim()
}

function extractFirstJsonObject(s: string): string | null {
  const text = stripCodeFences(s)
  const start = text.indexOf('{')
  if (start === -1) return null

  let depth = 0
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (ch === '{') depth++
    if (ch === '}') {
      depth--
      if (depth === 0) {
        return text.slice(start, i + 1)
      }
    }
  }

  return null
}

function tryParseJsonFromUnknown(result: unknown): unknown {
  if (!result) return null

  const rec = asRecord(result)
  const recData = asRecord(rec ? rec.data : null)

  // If the model returned an object already.
  if (rec && rec.response !== undefined) return rec
  if (recData && recData.response !== undefined) return recData

  // Try common string fields.
  const candidateStrings: string[] = []
  for (const key of ['output', 'text', 'result', 'message', 'content'] as const) {
    const v = rec ? rec[key] : undefined
    if (typeof v === 'string') candidateStrings.push(v)
  }
  for (const key of ['output', 'text', 'result', 'message', 'content'] as const) {
    const v = recData ? recData[key] : undefined
    if (typeof v === 'string') candidateStrings.push(v)
  }
  if (typeof result === 'string') candidateStrings.push(result)

  for (const s of candidateStrings) {
    const raw = stripCodeFences(s)
    try {
      return JSON.parse(raw)
    } catch {
      const obj = extractFirstJsonObject(raw)
      if (!obj) continue
      try {
        return JSON.parse(obj)
      } catch {
        // continue
      }
    }
  }

  return null
}

export const POST = withRequestLogging('clothes.upload.post', async (request: Request) => {
  const ip = getRequestIp(request)
  rateLimitOrThrow({key: `clothes:upload:${ip}`, limit: 30, windowMs: 60_000})

  const supabase = await createRouteSupabaseClient()
  const {data: userData, error: userError} = await supabase.auth.getUser()

  if (userError || !userData.user) {
    return fail(401, 'Unauthorized')
  }

  const form = await request.formData().catch(() => null)
  if (!form) return fail(400, 'Invalid form data')

  const file = form.get('file')
  if (!file || !(file instanceof File)) {
    return fail(400, 'Missing file')
  }

  if (!file.type.startsWith('image/')) {
    return fail(400, 'Invalid file type')
  }

  // 12MB max
  if (file.size > 12 * 1024 * 1024) {
    return fail(400, 'File too large')
  }

  const {model, prompt} = await loadPromptConfig('validate-image.yaml')

  // Upload to fal storage so we can pass a URL to the model.
  const imageUrl = await falUpload(file)

  const falRaw = await falSubscribe(model, {
    prompt,
    image_url: imageUrl,
  })

  const parsedJson = tryParseJsonFromUnknown(falRaw)
  const parsed = falResultSchema.safeParse(parsedJson)

  if (!parsed.success) {
    // Include a small snippet in non-production to help debugging prompt/model output.
    const rec = asRecord(falRaw)
    const recData = asRecord(rec ? rec.data : null)
    const textCandidate =
      (recData && typeof recData.text === 'string' ? recData.text : null) ??
      (rec && typeof rec.text === 'string' ? rec.text : null)

    const snippet = textCandidate
      ? stripCodeFences(textCandidate).slice(0, 200)
      : null

    const suffix = process.env.NODE_ENV === 'production'
      ? ''
      : snippet
        ? ` (got: ${JSON.stringify(snippet)})`
        : ''

    return fail(400, `Invalid AI response${suffix}`)
  }

  const normalizedType = parsed.data.type.toLowerCase() as string

  if (!parsed.data.response) {
    return ok({valid: false, type: 'none'})
  }

  if (!(allowedTypes as readonly string[]).includes(normalizedType)) {
    return fail(400, 'Unsupported clothing type')
  }

  const type = normalizedType as AllowedType

  const ext = safeExtension(file)
  const ts = Date.now()
  const objectPath = `${userData.user.id}/clothes/${type}/${ts}.${ext}`

  const admin = createSupabaseAdminClient()

  const {error: uploadError} = await admin.storage
    .from(USERS_BUCKET)
    .upload(objectPath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    return fail(400, uploadError.message)
  }

  const {data: signed, error: signError} = await admin.storage
    .from(USERS_BUCKET)
    .createSignedUrl(objectPath, 60 * 10)

  if (signError || !signed?.signedUrl) {
    return fail(400, signError?.message ?? 'Failed to sign URL')
  }

  return ok({
    valid: true,
    type,
    path: objectPath,
    signedUrl: signed.signedUrl,
  })
})
