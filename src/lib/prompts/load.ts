import fs from 'node:fs/promises'
import path from 'node:path'

import YAML from 'yaml'

export type PromptConfig = {
  model: string
  prompt: string
}

export async function loadPromptConfig(filename: string): Promise<PromptConfig> {
  const absPath = path.join(process.cwd(), 'prompts', filename)
  const raw = await fs.readFile(absPath, 'utf8')
  const parsed = YAML.parse(raw) as unknown

  const rec =
    parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null

  if (!rec || typeof rec.model !== 'string' || typeof rec.prompt !== 'string') {
    throw new Error(`Invalid prompt config: prompts/${filename}`)
  }

  return {
    model: rec.model,
    prompt: rec.prompt,
  }
}
