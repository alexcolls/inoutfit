'use client'

/* eslint-disable @next/next/no-img-element */

import * as React from 'react'

import {Accordion, AccordionContent, AccordionItem, AccordionTrigger} from '@/components/ui/accordion'
import {Button} from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {Separator} from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

type ClothesItem = {
  name: string
  path: string
  signedUrl: string
}

type ClothesGroup = {
  type: string
  items: ClothesItem[]
}

type ApiResponse<T> =
  | {ok: true; data: T}
  | {ok: false; error: string}

type LogLine = {
  id: string
  at: number
  level: 'info' | 'success' | 'error'
  message: string
}

function labelFromFilename(name: string) {
  const last = name.split('/').pop() ?? name
  const idx = last.lastIndexOf('.')
  return idx > 0 ? last.slice(0, idx) : last
}

export function ClothesSheet({
  open,
  onOpenChange,
  avatarPath,
  baseModelPath,
  onModelUpdated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Original selected avatar (used for prompt description)
  avatarPath: string | null
  // Current base model image to apply the clothing onto (can be avatar or latest output)
  baseModelPath: string | null
  onModelUpdated: (signedUrl: string, path: string) => void
}) {
  const [loading, setLoading] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [wearing, setWearing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [groups, setGroups] = React.useState<ClothesGroup[]>([])

  const [logOpen, setLogOpen] = React.useState(false)
  const [logLines, setLogLines] = React.useState<LogLine[]>([])

  const fileRef = React.useRef<HTMLInputElement | null>(null)

  function pushLog(level: LogLine['level'], message: string) {
    setLogLines((prev) => [
      ...prev,
      {id: crypto.randomUUID(), at: Date.now(), level, message},
    ])
  }

  async function refresh() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/clothes/list')
      const json = (await res.json().catch(() => null)) as ApiResponse<{groups: ClothesGroup[]}> | null
      if (!res.ok) {
        setError(json && 'error' in json ? json.error : 'Failed to load clothes')
        return
      }
      setGroups((json && 'data' in json ? json.data.groups : []) ?? [])
    } catch {
      setError('Failed to load clothes')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    if (!open) return
    refresh()
  }, [open])

  async function upload(file: File) {
    setUploading(true)
    setError(null)

    setLogLines([])
    setLogOpen(true)

    pushLog('info', `Selected: ${file.name || 'image'}`)
    pushLog('info', 'Uploading to server…')

    try {
      const form = new FormData()
      form.set('file', file)

      const res = await fetch('/api/clothes/upload', {
        method: 'POST',
        body: form,
      })

      pushLog('info', 'Validating with AI…')

      const json = (await res.json().catch(() => null)) as ApiResponse<
        {valid: boolean; type: string; path?: string; signedUrl?: string}
      > | null

      if (!res.ok) {
        const msg = json && 'error' in json ? json.error : 'Upload failed'
        setError(msg)
        pushLog('error', msg)
        return
      }

      const data = json && 'data' in json ? json.data : null
      if (!data) {
        setError('Upload failed')
        pushLog('error', 'Upload failed')
        return
      }

      if (!data.valid) {
        const msg = 'Invalid clothing photo. Try a single item flat lay or ghost mannequin.'
        setError(msg)
        pushLog('error', msg)
        return
      }

      pushLog('success', `Accepted as: ${data.type}`)
      pushLog('info', 'Refreshing wardrobe…')
      await refresh()
      pushLog('success', 'Done')
    } catch {
      setError('Upload failed')
      pushLog('error', 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function wear(clothesPath: string) {
    if (!avatarPath || !baseModelPath) {
      setError('Select a model first')
      return
    }

    setWearing(true)
    setError(null)

    setLogLines([])
    setLogOpen(true)

    pushLog('info', 'Starting try-on…')

    try {
      const res = await fetch('/api/clothes/wear', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({avatarPath, baseModelPath, clothesPath}),
      })

      pushLog('info', 'Generating…')

      const json = (await res.json().catch(() => null)) as ApiResponse<
        {signedUrl: string; path: string}
      > | null

      if (!res.ok) {
        const msg = json && 'error' in json ? json.error : 'Failed to wear model'
        setError(msg)
        pushLog('error', msg)
        return
      }

      const data = json && 'data' in json ? json.data : null
      if (!data?.signedUrl || !data?.path) {
        const msg = 'Failed to wear model'
        setError(msg)
        pushLog('error', msg)
        return
      }

      onModelUpdated(data.signedUrl, data.path)
      pushLog('success', 'Model updated')
    } catch {
      const msg = 'Failed to wear model'
      setError(msg)
      pushLog('error', msg)
    } finally {
      setWearing(false)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex flex-col">
        <SheetHeader>
          <SheetTitle>My clothes</SheetTitle>
          <SheetDescription>Upload a clothing photo and it will be organized by type.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex items-center gap-2">
          <Button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? 'Uploading…' : 'Upload'}
          </Button>
          <Button type="button" variant="outline" onClick={refresh} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void upload(f)
            }}
          />
        </div>

        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

        <Separator className="my-4" />

        <div className="flex-1 overflow-y-auto pr-1">
          {groups.length === 0 ? (
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm font-medium">No clothes yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload a single item photo to start building your wardrobe.
              </p>
            </div>
          ) : (
            <Accordion type="multiple" className="w-full">
              {groups.map((g) => (
                <AccordionItem key={g.type} value={g.type}>
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <span className="capitalize">{g.type}</span>
                      <span className="text-muted-foreground text-xs">({g.items.length})</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-2 gap-3">
                      {g.items.map((it) => (
                        <div key={it.path} className="space-y-2">
                          <div className="group relative aspect-9/16 overflow-hidden rounded-lg border bg-muted/40">
                            <img
                              src={it.signedUrl}
                              alt={labelFromFilename(it.name)}
                              className="h-full w-full object-cover"
                            />

                            <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center opacity-0 transition-opacity group-hover:opacity-100">
                              <Button
                                type="button"
                                size="sm"
                                disabled={wearing || !avatarPath || !baseModelPath}
                                className="pointer-events-auto"
                                onClick={() => void wear(it.path)}
                              >
                                Wear
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
        </SheetContent>
      </Sheet>

      <Dialog open={logOpen} onOpenChange={(v) => (!uploading ? setLogOpen(v) : null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Uploading clothes</DialogTitle>
            <DialogDescription>
              {uploading ? 'Please wait…' : 'You can close this when you are done.'}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 max-h-72 overflow-y-auto rounded-md border bg-card p-3">
            <ul className="space-y-2 text-sm">
              {logLines.map((l) => (
                <li key={l.id} className="flex items-start gap-2">
                  <span
                    className={
                      'mt-0.5 inline-block size-2 shrink-0 rounded-full ' +
                      (l.level === 'success'
                        ? 'bg-emerald-500'
                        : l.level === 'error'
                          ? 'bg-destructive'
                          : 'bg-muted-foreground')
                    }
                    aria-hidden
                  />
                  <span className="text-muted-foreground">[{new Date(l.at).toLocaleTimeString()}]</span>
                  <span className={l.level === 'error' ? 'text-destructive' : ''}>{l.message}</span>
                </li>
              ))}
            </ul>
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLogOpen(false)}
              disabled={uploading}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
