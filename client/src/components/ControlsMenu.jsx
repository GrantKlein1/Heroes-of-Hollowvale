import { CONTROLS_KEY, HUD_HINTS, menuSections } from '../game/controls'

function Keycap({ children, quiet = false }) {
  const tone = quiet
    ? 'border-stone-600/60 bg-stone-800/70 text-stone-400'
    : 'border-amber-700/70 bg-amber-950/80 text-amber-100'
  return (
    <kbd className={`inline-flex items-center whitespace-nowrap rounded border px-1 py-px font-sans text-[10px] font-semibold leading-none ${tone}`}>
      {children}
    </kbd>
  )
}

function ControlRow({ row, quiet = false }) {
  return (
    <div className="flex items-start gap-3 py-1">
      <div className="flex shrink-0 flex-wrap gap-1 pt-0.5">
        {row.keys.map((key) => (
          <Keycap key={key} quiet={quiet}>{key}</Keycap>
        ))}
      </div>
      <p className={quiet ? 'text-xs leading-snug text-stone-500' : 'text-sm leading-snug text-stone-200'}>
        {row.action}
      </p>
    </div>
  )
}

/**
 * Top-left hint. The chip is click-through except the Controls button.
 */
export function ControlsHint({ sceneHint = '', onOpen }) {
  return (
    <div className="pointer-events-none absolute left-2 top-2 z-10 max-w-[calc(100%-5.5rem)] sm:left-3 sm:top-3 sm:max-w-md">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded border border-amber-900/30 bg-stone-950/55 px-2 py-1 text-xs text-stone-200">
        {HUD_HINTS.map((hint) => (
          <span key={hint.label} className="inline-flex items-center gap-1">
            <Keycap>{hint.key}</Keycap>
            <span>{hint.label}</span>
          </span>
        ))}
        <button
          type="button"
          onClick={onOpen}
          className="pointer-events-auto inline-flex items-center gap-1 rounded border border-amber-900/40 bg-stone-900/80 px-1.5 py-0.5 text-amber-200 hover:bg-stone-800"
          aria-label="Controls"
          title="Controls"
        >
          <Keycap>{CONTROLS_KEY}</Keycap>
          <span>Controls</span>
        </button>
      </div>
      {sceneHint ? (
        <div className="mt-1 px-0.5 text-[10px] leading-snug text-stone-500">{sceneHint}</div>
      ) : null}
    </div>
  )
}

/**
 * Controls overlay. Matches the Options panel: dim backdrop, stone card, amber border.
 */
export default function ControlsMenu({ classId, onClose }) {
  const sections = menuSections(classId)
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="relative z-10 flex max-h-[86vh] w-[92%] max-w-xl flex-col rounded-xl border border-amber-900/40 bg-stone-900/95 p-6 shadow-xl"
        role="dialog"
        aria-label="Controls"
      >
        <h2 className="font-display text-3xl text-amber-200 mb-4">Controls</h2>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {sections.map((section) => (
            <section key={section.id}>
              <h3 className={section.quiet
                ? 'mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-500'
                : 'mb-1 text-sm font-semibold uppercase tracking-wide text-amber-200/80'}
              >
                {section.title}
              </h3>
              <div>
                {section.rows.map((row) => (
                  <ControlRow key={row.keys.join('-')} row={row} quiet={Boolean(section.quiet)} />
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-900 font-semibold shadow"
          >Back</button>
        </div>
      </div>
    </div>
  )
}
