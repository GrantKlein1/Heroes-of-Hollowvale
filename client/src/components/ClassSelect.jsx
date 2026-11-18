import { useState } from 'react'
import { CLASS_SPRITES, DEFAULT_ITEM_ICON, ITEM_ICONS } from '../config/paths'
import { CLASS_INTROS, CLASS_ORDER } from '../game/classIntro'

const BODY = 'text-[#f4e8d0]'

function StatRow({ label, phrase, fill }) {
  const clamped = Math.max(0, Math.min(1, fill))
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_6.75rem] items-center gap-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">{label}</div>
      <p className={`text-sm leading-tight ${BODY}`}>{phrase}</p>
      <div className="h-2 overflow-hidden rounded-full bg-stone-800" aria-hidden="true">
        <div className="h-full rounded-full bg-amber-500" style={{ width: `${clamped * 100}%` }} />
      </div>
    </div>
  )
}

function KitRow({ item }) {
  const icon = ITEM_ICONS[item.id] || DEFAULT_ITEM_ICON(item.id)
  return (
    <li className="grid grid-cols-[1.75rem_1.15rem_minmax(7.25rem,9.25rem)_6.4rem_minmax(0,1fr)] items-center gap-x-2">
      <img
        src={icon}
        alt=""
        className="h-7 w-7 object-contain"
        style={{ imageRendering: 'pixelated' }}
        onError={(event) => { event.currentTarget.style.visibility = 'hidden' }}
      />
      <span className="text-sm tabular-nums text-amber-200">{item.count}</span>
      <span className={`truncate text-sm ${BODY}`}>{item.name}</span>
      <span className="text-xs text-amber-200/80">{item.slotLabel}</span>
      <span className={`text-xs leading-tight ${BODY}`}>{item.effect}</span>
    </li>
  )
}

/**
 * Calling screen. Hover or focus previews a class. Choose starts that class.
 * Knight, Mage, Thief, Dwarf stay in that order, and Back is not a Choose button.
 */
export default function ClassSelect({ onChoose, onBack }) {
  const [activeId, setActiveId] = useState(CLASS_ORDER[0])
  const calling = CLASS_INTROS.find((entry) => entry.id === activeId) || CLASS_INTROS[0]

  return (
    <div className="absolute inset-0 z-30">
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="absolute inset-3 flex flex-col overflow-hidden rounded-2xl border border-amber-900/40 bg-stone-900/95 px-5 py-3 shadow-xl shadow-black/50"
        role="dialog"
        aria-labelledby="class-select-heading"
      >
        <div className="mb-2 flex items-start justify-between gap-4">
          <div>
            <h2 id="class-select-heading" className="font-display text-3xl leading-none text-amber-200">Choose Your Class</h2>
            <p className={`mt-1 text-sm ${BODY}`}>Rest on a calling to read it, then press Choose.</p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 rounded-lg bg-amber-600 px-5 py-2 font-semibold text-stone-900 shadow hover:bg-amber-500"
          >
            Back
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(220px,300px)_minmax(0,1fr)] gap-4">
          <div className="flex items-center justify-center overflow-hidden rounded-xl border border-amber-900/40 bg-stone-950/80">
            <img
              src={CLASS_SPRITES[calling.id]}
              alt={`${calling.name} portrait`}
              className="h-full max-h-full w-full object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>

          <div className="flex min-h-0 min-w-0 flex-col">
            <h3 className="font-display text-2xl leading-none text-amber-200">{calling.name}</h3>
            <p className={`mt-1 text-sm leading-tight ${BODY}`}>{calling.role}</p>

            <div className="mt-2 space-y-1">
              <StatRow label="Health" phrase={calling.health} fill={1} />
              <StatRow label="Pace" phrase={calling.pace.phrase} fill={calling.pace.fill} />
              <StatRow label="Blows" phrase={calling.blows.phrase} fill={calling.blows.fill} />
              <StatRow label="Guard" phrase={calling.guard.phrase} fill={calling.guard.fill} />
            </div>

            <h4 className="mb-0.5 mt-2 text-[11px] font-semibold uppercase tracking-wide text-amber-300">How you fight</h4>
            <p className={`text-sm leading-snug ${BODY}`}>{calling.fight}</p>

            <h4 className="mb-1 mt-2 text-[11px] font-semibold uppercase tracking-wide text-amber-300">Starting kit</h4>
            <ul className="space-y-0.5">
              {calling.kit.map((item) => (
                <KitRow key={item.id} item={item} />
              ))}
            </ul>
            <p className={`mt-1 text-sm leading-snug ${BODY}`}>{calling.purse}</p>
            <p className="mt-0.5 text-xs leading-snug text-amber-100/70">{calling.footnote}</p>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-4 gap-2">
          {CLASS_INTROS.map((entry) => {
            const selected = entry.id === calling.id
            return (
              <button
                key={entry.id}
                type="button"
                onMouseEnter={() => setActiveId(entry.id)}
                onFocus={() => setActiveId(entry.id)}
                onClick={() => onChoose(entry.id)}
                className={[
                  'rounded-lg px-3 py-2 font-semibold text-stone-900',
                  selected
                    ? 'bg-amber-500 ring-2 ring-amber-200'
                    : 'bg-amber-600 hover:bg-amber-500',
                ].join(' ')}
              >
                {`Choose ${entry.name}`}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
