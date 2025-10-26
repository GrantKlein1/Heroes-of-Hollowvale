import React from 'react'

export default function TypingIndicator({ who }) {
  return (
    <div className="flex items-center space-x-2 text-stone-300 text-sm">
      <span className="italic">{who} is thinking…</span>
      <span className="flex space-x-1">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-stone-300 animate-bounce [animation-delay:-0.2s]"></span>
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-stone-300 animate-bounce"></span>
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-stone-300 animate-bounce [animation-delay:0.2s]"></span>
      </span>
    </div>
  )
}
