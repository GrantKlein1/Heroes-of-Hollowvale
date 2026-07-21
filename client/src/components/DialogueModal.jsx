import React, { useEffect, useState } from 'react'
import { EventBus } from '../game/EventBus'

/**
 * Dialogue modal overlay. Opens when Phaser emits `start-dialogue`.
 * Closing emits `end-dialogue` so the scene can resume movement.
 */
export default function DialogueModal() {
  const [open, setOpen] = useState(false)
  const [speaker, setSpeaker] = useState('')
  const [lines, setLines] = useState([])
  const [lineIndex, setLineIndex] = useState(0)

  useEffect(() => {
    const onStart = (payload = {}) => {
      const nextLines = Array.isArray(payload.lines) ? payload.lines : [String(payload.text || '...')]
      setSpeaker(payload.speaker || 'Someone')
      setLines(nextLines)
      setLineIndex(0)
      setOpen(true)
    }

    EventBus.on('start-dialogue', onStart)
    return () => EventBus.off('start-dialogue', onStart)
  }, [])

  const close = () => {
    setOpen(false)
    EventBus.emit('end-dialogue')
  }

  const advance = () => {
    if (lineIndex < lines.length - 1) {
      setLineIndex((i) => i + 1)
    } else {
      close()
    }
  }

  if (!open) return null

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center p-4 md:items-center md:p-8">
      <div className="absolute inset-0 bg-black/45" onClick={close} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialogue-speaker"
        className="relative z-10 w-full max-w-xl rounded-lg border border-amber-900/50 bg-[#2a2118]/95 p-5 text-stone-100 shadow-2xl backdrop-blur-sm"
      >
        <h2 id="dialogue-speaker" className="font-display text-lg text-amber-200">
          {speaker}
        </h2>
        <p className="mt-3 min-h-[3.5rem] text-sm leading-relaxed text-stone-200">
          {lines[lineIndex]}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="rounded border border-stone-600/80 px-3 py-1.5 text-sm text-stone-300 hover:bg-stone-800/80"
          >
            Close
          </button>
          <button
            type="button"
            onClick={advance}
            className="rounded border border-amber-800/70 bg-amber-900/40 px-3 py-1.5 text-sm text-amber-100 hover:bg-amber-800/50"
          >
            {lineIndex < lines.length - 1 ? 'Next' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  )
}
