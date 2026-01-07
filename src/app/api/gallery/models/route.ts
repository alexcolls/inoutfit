import {NextResponse} from 'next/server'

export const runtime = 'nodejs'

export const GET = (request: Request) => {
  // Backward-compatible alias. The gallery folder for avatars is now `avatars/`.
  return NextResponse.redirect(new URL('/api/gallery/avatars', request.url))
}
