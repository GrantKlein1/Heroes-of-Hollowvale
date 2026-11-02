import React from 'react'
import Game from './Game'

/**
 * React overlays (title, inventory, chat, HUD) sit on top of the Phaser scene.
 * `Game.jsx` owns that UI; `HollowvaleScene` owns movement, collision, and rendering.
 */
export default function App() {
  return <Game />
}
