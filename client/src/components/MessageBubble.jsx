import React from 'react'

export default function MessageBubble({ role, text }) {
  const isUser = role === 'user'
  return (
    <div className={[
      'flex w-full',
      isUser ? 'justify-end' : 'justify-start'
    ].join(' ')}>
      <div className={[
        'max-w-[80%] px-4 py-3 rounded-2xl shadow',
        'border',
        isUser
          ? 'bg-amber-200 text-stone-900 border-amber-300'
          : 'bg-stone-800/80 text-stone-100 border-amber-900/40'
      ].join(' ')}>
        <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
      </div>
    </div>
  )
}
