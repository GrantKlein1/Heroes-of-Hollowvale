import React from 'react'
import PhaserGame from './components/PhaserGame'
import GameHUD from './components/GameHUD'
import DialogueModal from './components/DialogueModal'

/**
 * Main layout: Phaser canvas fills the viewport; React HUD / dialogue
 * overlays sit above it via absolute positioning.
 */
export default function App() {
  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
      <PhaserGame />
      <GameHUD />
      <DialogueModal />
    </div>
  )
}
