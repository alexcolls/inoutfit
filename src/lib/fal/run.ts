import { fal } from '@fal-ai/client'

import {getFalKey} from '@/lib/fal/client'

let configured = false

export function ensureFalConfigured() {
  if (configured) return
  fal.config({
    credentials: getFalKey(),
  })
  configured = true
}

export async function falUpload(file: File) {
  ensureFalConfigured()
  return fal.storage.upload(file)
}

export async function falRun(model: string, input: Record<string, unknown>) {
  ensureFalConfigured()
  return fal.run(model, {input})
}

export async function falSubscribe(model: string, input: Record<string, unknown>) {
  ensureFalConfigured()
  return fal.subscribe(model, {input})
}
