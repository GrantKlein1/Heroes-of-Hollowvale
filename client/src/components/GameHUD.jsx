import React, { useEffect, useState } from 'react'
import { EventBus } from '../game/EventBus'

/**
 * React HUD overlay layered above the Phaser canvas.
 * Subscribes to player state events from MainGameScene.
 */
export default function GameHUD() {
  const [health, setHealth] = useState(100)
  const [maxHealth, setMaxHealth] = useState(100)
  const [hintVisible, setHintVisible] = useState(true)

  useEffect(() => {
    const onHealth = (value) => setHealth(value)
    const onMaxHealth = (value) => setMaxHealth(value)
    const onDialogue = () => setHintVisible(false)

    EventBus.on('player-health-changed', onHealth)
    EventBus.on('player-max-health-changed', onMaxHealth)
    EventBus.on('start-dialogue', onDialogue)

    const hintTimer = setTimeout(() => setHintVisible(false), 8000)

    return () => {
      EventBus.off('player-health-changed', onHealth)
      EventBus.off('player-max-health-changed', onMaxHealth)
      EventBus.off('start-dialogue', onDialogue)
      clearTimeout(hintTimer)
    }
  }, [])

  const pct = maxHealth > 0 ? Math.max(0, Math.min(100, (health / maxHealth) * 100)) : 0

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="absolute top-4 left-4 w-56 select-none">
        <div className="mb-1 text-xs tracking-wide text-amber-100/90 font-display">Health</div>
        <div className="h-3 w-full overflow-hidden rounded border border-amber-900/60 bg-stone-950/70">
          <div
            className="h-full bg-gradient-to-r from-red-800 to-red-500 transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1 text-right text-[11px] text-stone-300">
          {Math.round(health)} / {Math.round(maxHealth)}
        </div>
      </div>

      {hintVisible && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded border border-amber-900/40 bg-stone-950/70 px-4 py-2 text-sm text-amber-100/90 shadow-lg backdrop-blur-sm">
          WASD / Arrows to move · E near townsfolk to talk
        </div>
      )}
    </div>
  )
}
