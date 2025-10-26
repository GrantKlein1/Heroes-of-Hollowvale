import React, { useEffect, useMemo, useRef, useState } from 'react'
import MessageBubble from './MessageBubble'
import TypingIndicator from './TypingIndicator'
import { sendChat } from '../lib/api'

const NPC_NAMES = {
  bartender: 'The Bartender',
  wizard: 'The Wizard',
  rogue: 'The Rogue',
}

export default function ChatPanel({ npc }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const who = NPC_NAMES[npc] || 'NPC'
  const scrollRef = useRef(null)

  // Reset local conversation when NPC changes
  useEffect(() => {
    setMessages([])
  }, [npc])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const placeholder = useMemo(() => {
    switch (npc) {
      case 'bartender':
        return 'Share a tale or ask for advice…'
      case 'wizard':
        return 'Pose a riddle or seek arcane lore…'
      case 'rogue':
        return 'Ask for street wisdom or a sneaky tip…'
      default:
        return 'Say hello…'
    }
  }, [npc])

  async function onSend(e) {
    e?.preventDefault()
    const text = input.trim()
    if (!text) return

    const next = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const res = await sendChat({ npc, message: text })
      const reply = res?.reply ?? '[No reply]'
      setMessages([...next, { role: 'assistant', content: reply }])
    } catch (err) {
      setMessages([...next, { role: 'assistant', content: 'The air goes still. Something went wrong with the magic.' }])
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[70vh] sm:h-[75vh]">
      <div className="px-4 py-3 border-b border-amber-900/40 flex items-center justify-between">
        <div>
          <h3 className="font-display text-2xl text-amber-200">{who}</h3>
          <p className="text-stone-300/80 text-sm">Speak, traveler.</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-stone-300/80 text-sm italic">The tavern hums softly. Start a conversation…</div>
        )}
        {messages.map((m, idx) => (
          <MessageBubble key={idx} role={m.role} text={m.content} />
        ))}
        {loading && <TypingIndicator who={who} />}
      </div>

      <form onSubmit={onSend} className="p-3 border-t border-amber-900/40">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg bg-stone-800/80 border border-amber-900/40 text-stone-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
            placeholder={placeholder}
            value={input}
            onChange={e => setInput(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-stone-900 font-semibold shadow"
          >Send</button>
        </div>
      </form>
    </div>
  )
}
