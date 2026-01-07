export function safeNextPath(next: string | null | undefined, fallbackPath: string) {
  if (!next) return fallbackPath

  // Only allow internal paths.
  // Disallow protocol-relative (//), absolute URLs, and weird whitespace.
  if (!next.startsWith('/')) return fallbackPath
  if (next.startsWith('//')) return fallbackPath
  if (next.includes('://')) return fallbackPath
  if (/\s/.test(next)) return fallbackPath
  if (next.includes('\\')) return fallbackPath

  return next
}