import React, { useEffect, useRef, useState } from 'react'
import { EventBus, GameEvents } from '../game/EventBus'
import { sendChat } from '../lib/api'
import { speakNpcDialogue, cancelNpcSpeech } from '../lib/dialogueAudio'

const TOPIC_PROMPTS = {
  dragon: {
    label: 'Ask about the Dragon Quest',
    message: 'Tell me about the Dragon Quest, and make sure to tell the player to go south of the tavern to explore.',
    ragHints: 'Ashfang Cavern, Blackspire Mountains, dragon raids, goblins, traps, hoard, Sword of Aeltharion',
  },
  history: {
    label: 'Ask about Hollowvale history',
    message: 'Tell me the history of Hollowvale.',
    ragHints: "Hollowvale history, Empire of Drak'Tal, Dragonbind Chains, Veyrath, Pyrehold, Sword of Aeltharion",
  },
}

/**
 * Dialogue modal overlay. Opens when Phaser emits `start-dialogue`.
 * Streams ElevenLabs TTS for spoken lines; supports AI bartender chat via /api/chat.
 */
export default function DialogueModal() {
  const [open, setOpen] = useState(false)
  const [speaker, setSpeaker] = useState('')
  const [npcId, setNpcId] = useState(null)
  const [aiMode, setAiMode] = useState(false)
  const [lines, setLines] = useState([])
  const [lineIndex, setLineIndex] = useState(0)
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(() =>
    (localStorage.getItem('ttsEnabled') ?? 'true') !== 'false'
  )
  const [ttsVolume] = useState(() => {
    const v = Number(localStorage.getItem('ttsVolume') ?? 80)
    return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) / 100 : 0.8
  })
  const scrollRef = useRef(null)
  const ttsEnabledRef = useRef(ttsEnabled)

  useEffect(() => {
    ttsEnabledRef.current = ttsEnabled
    localStorage.setItem('ttsEnabled', String(ttsEnabled))
  }, [ttsEnabled])

  const speak = (text) => {
    if (!ttsEnabledRef.current || !text) return
    speakNpcDialogue(text, { volume: ttsVolume, enabled: true }).catch(() => {})
  }

  useEffect(() => {
    const onStart = (payload = {}) => {
      const nextLines = Array.isArray(payload.lines)
        ? payload.lines
        : [String(payload.text || '...')]
      const npc = payload.npc || null
      setSpeaker(payload.speaker || 'Someone')
      setNpcId(npc)
      setAiMode(!!payload.ai && !!npc)
      setLines(nextLines)
      setLineIndex(0)
      setMessages(
        nextLines.map((content) => ({ role: 'assistant', content }))
      )
      setChatInput('')
      setOpen(true)
      // Non-AI scripts speak here; AI path speaks via a follow-up npc:speak emit
      if (!(payload.ai && npc) && nextLines[0]) {
        speak(nextLines[0])
      }
    }

    const onSpeak = ({ text } = {}) => {
      if (text) speak(text)
    }

    EventBus.on(GameEvents.START_DIALOGUE, onStart)
    EventBus.on(GameEvents.NPC_SPEAK, onSpeak)
    return () => {
      EventBus.off(GameEvents.START_DIALOGUE, onStart)
      EventBus.off(GameEvents.NPC_SPEAK, onSpeak)
      cancelNpcSpeech()
    }
  }, [ttsVolume])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading, open])

  const close = () => {
    cancelNpcSpeech()
    setOpen(false)
    setAiMode(false)
    setNpcId(null)
    EventBus.emit(GameEvents.END_DIALOGUE)
  }

  const advance = () => {
    if (aiMode) return
    if (lineIndex < lines.length - 1) {
      const next = lineIndex + 1
      setLineIndex(next)
      EventBus.emit(GameEvents.NPC_SPEAK, { text: lines[next], speaker, npc: npcId })
    } else {
      close()
    }
  }

  const askTopic = async (kind) => {
    const topic = TOPIC_PROMPTS[kind]
    if (!topic || loading || !npcId) return
    setMessages((m) => [...m, { role: 'user', content: topic.label }])
    await sendNpcMessage(topic.message, topic.ragHints)
  }

  const sendFreeText = async () => {
    const text = chatInput.trim()
    if (!text || loading || !npcId) return
    setChatInput('')
    setMessages((m) => [...m, { role: 'user', content: text }])
    await sendNpcMessage(text)
  }

  const sendNpcMessage = async (message, ragHints) => {
    setLoading(true)
    try {
      const context = messages.slice(-5)
      const res = await sendChat({
        npc: npcId || 'bartender',
        message,
        context,
        ragHints,
      })
      const reply = res?.reply || '...'
      setMessages((m) => [...m, { role: 'assistant', content: reply }])
      EventBus.emit(GameEvents.NPC_SPEAK, {
        npc: npcId,
        speaker,
        text: reply,
      })
    } catch (err) {
      const fail = `Sorry traveler — ${err.message}`
      setMessages((m) => [...m, { role: 'assistant', content: fail }])
    } finally {
      setLoading(false)
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
        className="relative z-10 flex w-full max-w-xl flex-col rounded-lg border border-amber-900/50 bg-[#2a2118]/95 p-5 text-stone-100 shadow-2xl backdrop-blur-sm"
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 id="dialogue-speaker" className="font-display text-lg text-amber-200">
            {speaker}
          </h2>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-stone-400 select-none">
            <input
              type="checkbox"
              checked={ttsEnabled}
              onChange={(e) => setTtsEnabled(e.target.checked)}
              className="accent-amber-500"
            />
            Voice
          </label>
        </div>

        {aiMode ? (
          <>
            <div
              ref={scrollRef}
              className="mb-3 max-h-52 space-y-2 overflow-y-auto rounded border border-stone-800/80 bg-stone-950/40 p-3 text-sm leading-relaxed"
            >
              {messages.map((m, i) => (
                <div
                  key={`${m.role}-${i}`}
                  className={m.role === 'user' ? 'text-amber-100/90' : 'text-stone-200'}
                >
                  <span className="mr-1 text-[10px] uppercase tracking-wide text-stone-500">
                    {m.role === 'user' ? 'You' : speaker}
                  </span>
                  {m.content}
                </div>
              ))}
              {loading && (
                <div className="animate-pulse text-stone-500 text-xs">Thinking…</div>
              )}
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => askTopic('dragon')}
                className="rounded border border-amber-800/70 bg-amber-900/30 px-2.5 py-1 text-xs text-amber-100 hover:bg-amber-800/40 disabled:opacity-50"
              >
                Dragon Quest
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => askTopic('history')}
                className="rounded border border-amber-800/70 bg-amber-900/30 px-2.5 py-1 text-xs text-amber-100 hover:bg-amber-800/40 disabled:opacity-50"
              >
                Town History
              </button>
            </div>

            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                sendFreeText()
              }}
            >
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={loading}
                placeholder="Say something…"
                className="min-w-0 flex-1 rounded border border-stone-700 bg-stone-950/70 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-500 focus:border-amber-700 focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading || !chatInput.trim()}
                className="rounded border border-amber-800/70 bg-amber-900/40 px-3 py-2 text-sm text-amber-100 hover:bg-amber-800/50 disabled:opacity-50"
              >
                Send
              </button>
              <button
                type="button"
                onClick={close}
                className="rounded border border-stone-600/80 px-3 py-2 text-sm text-stone-300 hover:bg-stone-800/80"
              >
                Leave
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="mt-1 min-h-[3.5rem] text-sm leading-relaxed text-stone-200">
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
          </>
        )}
      </div>
    </div>
  )
}
