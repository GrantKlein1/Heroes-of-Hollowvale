import React from 'react'
import Game from './Game'

/**
 * Main layout: the full canvas RPG (`Game.jsx`) owns the scene state machine,
 * HUD, dialogue, inventory and all overlays. The experimental Phaser host
 * (`components/PhaserGame.jsx`) remains in the tree for the procedural-terrain
 * track but is intentionally not mounted here — it only renders a single,
 * zoomed-in village with no scene transitions, which is not the playable game.
 */
export default function App() {
  return <Game />
}
