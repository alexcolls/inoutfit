'use client'

/* eslint-disable @next/next/no-img-element */

import {CheckIcon, ChevronRightIcon} from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'
import {useTranslations} from 'next-intl'

import {ClothesSheet} from '@/components/clothes/clothes-sheet'
import {Button} from '@/components/ui/button'

type GalleryItem = {
  name: string
  path: string
  signedUrl: string
}

type ApiResponse<T> =
  | {ok: true; data: T}
  | {ok: false; error: string}

type Props = {
  locale: string
}

export function CreationWizard({locale}: Props) {
  const t = useTranslations('Create')

  const [step, setStep] = React.useState<1 | 2 | 3>(1)

  const [loading, setLoading] = React.useState(true)
  const [items, setItems] = React.useState<GalleryItem[]>([])
  const [warning, setWarning] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedPath, setSelectedPath] = React.useState<string | null>(null)

  // Current model image used for preview and as the base for successive try-on operations.
  // `currentModelPath` is a storage path (gallery avatars/* or users <uid>/outputs/*).
  const [currentModelUrl, setCurrentModelUrl] = React.useState<string | null>(null)
  const [currentModelPath, setCurrentModelPath] = React.useState<string | null>(null)

  const [clothesOpen, setClothesOpen] = React.useState(false)

  const isStep1Complete = Boolean(selectedPath)

  // Step 2 is complete once we have generated at least one try-on output (stored in users bucket).
  const isStep2Complete = Boolean(currentModelPath && !currentModelPath.startsWith('avatars/'))

  const canGoNext = step === 1 ? isStep1Complete : step === 2 ? isStep2Complete : false

  React.useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      setWarning(null)

      try {
        const res = await fetch('/api/gallery/avatars', {method: 'GET'})
        const json = (await res.json().catch(() => null)) as ApiResponse<
          {items: GalleryItem[]; warning?: string}
        > | null

        if (!res.ok) {
          setError(json && 'error' in json ? json.error : t('loadError'))
          return
        }

        const data = json && 'data' in json ? json.data : null
        if (!data) {
          setError(t('loadError'))
          return
        }

        if (!cancelled) {
          setItems(data.items ?? [])
          setWarning(data.warning ?? null)
        }
      } catch {
        if (!cancelled) setError(t('loadError'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [t])

  function onNext() {
    if (step === 1 && isStep1Complete) setStep(2)
    if (step === 2 && isStep2Complete) setStep(3)
  }

  function onBack() {
    if (step === 2) setStep(1)
    if (step === 3) setStep(2)
  }

  // Keep a stable current model preview URL/path (can be replaced by try-on output).
  React.useEffect(() => {
    if (!selectedPath) {
      setCurrentModelUrl(null)
      setCurrentModelPath(null)
      return
    }

    const selected = items.find((x) => x.path === selectedPath) ?? null
    setCurrentModelUrl(selected?.signedUrl ?? null)
    setCurrentModelPath(selected?.path ?? selectedPath)
  }, [items, selectedPath])

  // When entering step 2, show the clothes drawer by default.
  React.useEffect(() => {
    if (step === 2) setClothesOpen(true)
  }, [step])

  function baseName(filename: string) {
    const last = filename.split('/').pop() ?? filename
    const idx = last.lastIndexOf('.')
    if (idx <= 0) return last
    return last.slice(0, idx)
  }

  function StepChip({
    n,
    label,
    state,
  }: {
    n: 1 | 2 | 3
    label: string
    state: 'done' | 'active' | 'todo'
  }) {
    const base =
      'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition'

    if (state === 'done') {
      return (
        <span className={`${base} border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300`}>
          <span className="grid size-5 place-items-center rounded-full border border-emerald-500/40 bg-emerald-500/15">
            <CheckIcon className="size-3" />
          </span>
          <span className="font-medium">{label}</span>
        </span>
      )
    }

    if (state === 'active') {
      return (
        <span className={`${base} border-foreground/25 bg-card`}>
          <span className="grid size-5 place-items-center rounded-full border border-foreground/25 bg-background text-xs font-semibold">
            {n}
          </span>
          <span className="font-medium">{label}</span>
        </span>
      )
    }

    return (
      <span className={`${base} border-border bg-transparent text-muted-foreground`}>
        <span className="grid size-5 place-items-center rounded-full border border-border bg-background text-xs font-semibold">
          {n}
        </span>
        <span className="font-medium">{label}</span>
      </span>
    )
  }

  const title =
    step === 1 ? t('titleChooseModel') : step === 2 ? t('titleUploadOutfit') : t('titleConfirm')

  const subtitle =
    step === 1
      ? t('subtitleBusiness')
      : step === 2
        ? t('subtitleUploadOutfit')
        : t('subtitleConfirm')

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href={`/${locale}`}>{t('exit')}</Link>
          </Button>

          {step === 2 ? (
            <Button type="button" variant="outline" onClick={() => setClothesOpen(true)}>
              {t('myClothes')}
            </Button>
          ) : null}

          <Button type="button" variant="outline" onClick={onBack} disabled={step === 1}>
            {t('backStep')}
          </Button>

          <Button type="button" onClick={onNext} disabled={!canGoNext}>
            {t('nextStep')}
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <StepChip
          n={1}
          label={t('stepModels')}
          state={isStep1Complete ? 'done' : step === 1 ? 'active' : 'todo'}
        />
        <span className="text-muted-foreground">/</span>
        <StepChip
          n={2}
          label={t('stepOutfit')}
          state={isStep2Complete ? (step === 2 ? 'active' : step === 3 ? 'done' : 'todo') : step === 2 ? 'active' : 'todo'}
        />
        <span className="text-muted-foreground">/</span>
        <StepChip n={3} label={t('stepConfirm')} state={step === 3 ? 'active' : 'todo'} />
      </div>

      {step === 1 ? (
        <section className="mt-8">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{t('modelsTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('modelsSubtitle')}</p>
          </div>

        {warning ? (
          <div className="mt-4 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{t('setupTitle')}</p>
            <p className="mt-1">{t('setupBody')}</p>
            <ul className="mt-2 list-disc pl-5">
              <li>{t('setupStep1')}</li>
              <li>{t('setupStep2')}</li>
            </ul>
            <p className="mt-2 text-xs">{warning}</p>
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

        {loading ? (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({length: 8}).map((_, i) => (
              <div
                key={i}
                className="aspect-9/16 rounded-lg border bg-muted/40"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-6 rounded-xl border bg-card p-6">
            <p className="text-sm font-medium">{t('emptyTitle')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('emptyBody')}</p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {items.map((it) => {
              const selected = it.path === selectedPath
              return (
                <button
                  key={it.path}
                  type="button"
                  onClick={() => setSelectedPath(it.path)}
                  className={
                    "group relative aspect-9/16 overflow-hidden rounded-lg border bg-card text-left transition " +
                    (selected ? 'ring-2 ring-primary' : 'hover:border-foreground/30')
                  }
                >
                  <img
                    src={it.signedUrl}
                    alt={baseName(it.name)}
                    className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                  />

                  <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="max-w-[90%] truncate rounded-full bg-black/60 px-3 py-1 text-xs text-white">
                      {baseName(it.name)}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
        </section>
      ) : step === 2 ? (
        <section className="mt-10">
          <div className="mx-auto max-w-md text-center">
            <h2 className="text-lg font-semibold">{t('uploadTitle')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('uploadSubtitle')}</p>
          </div>

          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => setClothesOpen(true)}
              className="group relative w-full max-w-sm overflow-hidden rounded-xl border bg-card p-2 transition hover:border-foreground/25"
            >
              <div className="relative aspect-9/16 overflow-hidden rounded-lg">
                <img
                  src={currentModelUrl ?? ''}
                  alt={selectedPath ? baseName(selectedPath) : ''}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              </div>
            </button>
          </div>

          <ClothesSheet
            open={clothesOpen}
            onOpenChange={setClothesOpen}
            avatarPath={selectedPath}
            baseModelPath={currentModelPath ?? selectedPath}
            onModelUpdated={(signedUrl, path) => {
              setCurrentModelUrl(signedUrl)
              setCurrentModelPath(path)
            }}
          />

          {!isStep2Complete ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">{t('step2HintWear')}</p>
          ) : null}
        </section>
      ) : (
        <section className="mt-10">
          <div className="mx-auto max-w-md text-center">
            <h2 className="text-lg font-semibold">{t('confirmTitle')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('confirmSubtitle')}</p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border bg-card p-2">
              <div className="relative aspect-9/16 overflow-hidden rounded-lg">
                <img
                  src={currentModelUrl ?? ''}
                  alt={selectedPath ? baseName(selectedPath) : ''}
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="mt-2 text-center text-sm text-muted-foreground">{t('finalOutfit')}</p>
            </div>

            {Array.from({length: 3}).map((_, i) => (
              <div key={i} className="rounded-xl border border-dashed bg-card p-2">
                <div className="relative aspect-9/16 overflow-hidden rounded-lg bg-muted/30" />
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  {t('photoshootPlaceholder', {n: i + 1})}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
