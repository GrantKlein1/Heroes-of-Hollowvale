import React, { useEffect, useMemo, useState } from 'react'
import { buildFieldGuide } from '../game/codex/fieldGuide.js'

const PORTRAIT_PX = 96
const THUMB_PX = 32

function hideBrokenImage(event) {
  event.currentTarget.style.visibility = 'hidden'
}

/**
 * Square well used for every guide image. Atlas entries are cropped to one frame.
 * @param {{ image?: { src?: string, frame?: { x: number, y: number, w: number, h: number }, sheet?: { w: number, h: number } }, alt: string, pixels: number }} props
 */
function GuidePortrait({ image, alt, pixels }) {
  const src = image?.src || ''
  const frame = image?.frame
  const sheet = image?.sheet
  const cropped = Boolean(src && frame && sheet && frame.w > 0 && frame.h > 0 && sheet.w > 0 && sheet.h > 0)
  const scale = cropped ? Math.min(pixels / frame.w, pixels / frame.h) : 1

  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-amber-900/40 bg-stone-950/80"
      style={{ width: pixels, height: pixels }}
      data-testid={pixels === PORTRAIT_PX ? 'field-guide-portrait' : undefined}
    >
      {src && cropped && (
        <div
          className="relative overflow-hidden"
          style={{ width: frame.w * scale, height: frame.h * scale, minWidth: 0 }}
        >
          <img
            key={src}
            src={src}
            alt={alt}
            onError={hideBrokenImage}
            className="absolute max-w-none"
            style={{
              width: sheet.w * scale,
              height: sheet.h * scale,
              left: -frame.x * scale,
              top: -frame.y * scale,
              imageRendering: 'pixelated',
            }}
          />
        </div>
      )}
      {src && !cropped && (
        <img
          key={src}
          src={src}
          alt={alt}
          className="h-full w-full object-contain"
          style={{ imageRendering: 'pixelated' }}
          onError={hideBrokenImage}
        />
      )}
    </div>
  )
}

/**
 * Read-only heroes, enemies, and items guide.
 * @param {{ open: boolean, onClose: () => void }} props
 */
export default function FieldGuide({ open, onClose }) {
  const guide = useMemo(() => buildFieldGuide(), [])
  const [tabId, setTabId] = useState(guide.tabs[0].id)
  const [selectedId, setSelectedId] = useState(guide.tabs[0].entries[0].id)

  useEffect(() => {
    if (!open) return
    const first = guide.tabs[0]
    setTabId(first.id)
    setSelectedId(first.entries[0].id)
  }, [open, guide])

  if (!open) return null

  const tab = guide.tabs.find((entry) => entry.id === tabId) || guide.tabs[0]
  const selected = tab.entries.find((entry) => entry.id === selectedId) || tab.entries[0]

  const chooseTab = (nextId) => {
    const next = guide.tabs.find((entry) => entry.id === nextId)
    if (!next) return
    setTabId(next.id)
    setSelectedId(next.entries[0].id)
  }

  let lastCategory = ''

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-4" data-testid="field-guide">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="field-guide-title"
        className="relative z-10 flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-amber-900/40 bg-stone-900/95 shadow-xl shadow-black/50"
      >
        <div className="flex items-center justify-between border-b border-amber-900/40 px-5 py-4">
          <div>
            <h2 id="field-guide-title" className="font-display text-3xl text-amber-200">Field Guide</h2>
            <p className="text-sm text-stone-300/80">Heroes, foes, and gear, in plain words.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-300 hover:text-amber-300"
            aria-label="Close field guide"
          >✕</button>
        </div>

        <div className="flex gap-2 border-b border-amber-900/40 px-5 py-3">
          {guide.tabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              data-testid={`field-guide-tab-${entry.id}`}
              onClick={() => chooseTab(entry.id)}
              className={[
                'rounded-lg px-3 py-1.5 text-sm font-semibold',
                entry.id === tab.id
                  ? 'bg-amber-600 text-stone-900'
                  : 'bg-stone-800 text-amber-200 hover:bg-stone-700',
              ].join(' ')}
            >{entry.label}</button>
          ))}
        </div>

        {tab.note && (
          <p className="px-5 pt-3 text-sm text-stone-300/90" data-testid="field-guide-note">{tab.note}</p>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-5 md:grid-cols-[260px_1fr]">
          <div className="max-h-[55vh] overflow-y-auto pr-1" data-testid="field-guide-list">
            {tab.entries.map((entry) => {
              const showCategory = entry.category && entry.category !== lastCategory
              lastCategory = entry.category
              return (
                <div key={entry.id}>
                  {showCategory && (
                    <div className="mb-1 mt-3 text-xs font-medium uppercase tracking-wide text-amber-300/80 first:mt-0">
                      {entry.category}
                    </div>
                  )}
                  <button
                    type="button"
                    data-testid={`field-guide-entry-${entry.id}`}
                    aria-label={entry.name}
                    onClick={() => setSelectedId(entry.id)}
                    className={[
                      'mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                      entry.id === selected.id
                        ? 'bg-amber-600/90 text-stone-900'
                        : 'text-stone-200 hover:bg-stone-800',
                    ].join(' ')}
                  >
                    <GuidePortrait image={entry.image} alt={entry.name} pixels={THUMB_PX} />
                    <span className="min-w-0 leading-tight">{entry.name}</span>
                  </button>
                </div>
              )
            })}
          </div>

          <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-amber-900/40 bg-stone-800/70 p-4" data-testid="field-guide-detail">
            <div className="flex items-start gap-4">
              <GuidePortrait image={selected.image} alt={selected.name} pixels={PORTRAIT_PX} />
              <div className="min-w-0">
                <h3 className="text-xl font-semibold text-amber-200">{selected.name}</h3>
                <p className="mt-1 text-sm text-stone-200">{selected.blurb}</p>
              </div>
            </div>
            <dl className="mt-3 space-y-2">
              {selected.stats.map((row) => (
                <div key={row.label}>
                  <dt className="text-sm font-medium text-amber-300">{row.label}</dt>
                  <dd className="text-sm text-stone-200/90">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
