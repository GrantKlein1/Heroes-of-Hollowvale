import React, { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import HollowvaleScene from '../game/scenes/HollowvaleScene'

/**
 * Hosts the Phaser game. React overlays (HUD, chat, inventory) sit above this canvas.
 *
 * Dev StrictMode runs this effect, cleans it up, then runs it again before the
 * next task. Phaser.Game#destroy only flags pendingDestroy and drops the canvas
 * on a later step, so constructing the game inside the effect leaves two games
 * and two canvases. The microtask below starts the game after that replay; the
 * cleanup cancels the start it scheduled.
 */
export default function PhaserGame({ className = '' }) {
  const containerRef = useRef(null)
  const gameRef = useRef(null)

  useEffect(() => {
    const parent = containerRef.current
    if (!parent) return undefined

    let cancelled = false

    queueMicrotask(() => {
      if (cancelled || gameRef.current || !parent.isConnected) return

      const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent,
        backgroundColor: '#000000',
        physics: {
          default: 'arcade',
          arcade: {
            gravity: { x: 0, y: 0 },
            debug: false,
            fps: 60,
          },
        },
        fps: {
          target: 60,
          forceSetTimeOut: false,
        },
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.NO_CENTER,
          width: window.innerWidth,
          height: window.innerHeight,
        },
        render: {
          pixelArt: true,
          antialias: false,
          antialiasGL: false,
          roundPixels: true,
          powerPreference: 'high-performance',
        },
        // Music and TTS stay on the React/WebAudio path.
        audio: { noAudio: true },
        scene: [HollowvaleScene],
        banner: false,
      })
      gameRef.current = game
    })

    return () => {
      cancelled = true
      const game = gameRef.current
      gameRef.current = null
      if (game) game.destroy(true)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={`phaser-game-host absolute inset-0 z-0 h-full w-full ${className}`}
      aria-label="Game canvas"
    />
  )
}
