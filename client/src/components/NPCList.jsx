import React from 'react'

const NPCS = [
  { id: 'bartender', name: 'The Bartender', hint: 'Warm and wise' },
  { id: 'wizard', name: 'The Wizard', hint: 'Cryptic riddler' },
  { id: 'rogue', name: 'The Rogue', hint: 'Witty and sly' },
]

export default function NPCList({ value, onChange }) {
  return (
    <div>
      <h2 className="font-display text-2xl text-amber-200 mb-3">Patrons</h2>
      <ul className="space-y-3">
        {NPCS.map(npc => (
          <li key={npc.id}>
            <button
              className={[
                'w-full text-left px-4 py-3 rounded-lg border transition shadow-sm',
                'bg-stone-800/80 hover:bg-stone-700/80',
                'border-amber-900/40 hover:border-amber-600/60',
                'focus:outline-none focus:ring-2 focus:ring-amber-400/60',
                value === npc.id ? 'ring-2 ring-amber-400/60' : ''
              ].join(' ')}
              onClick={() => onChange(npc.id)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-amber-200">{npc.name}</div>
                  <div className="text-sm text-stone-300/80">{npc.hint}</div>
                </div>
                <div className="text-amber-300/80">{value === npc.id ? '●' : '○'}</div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
