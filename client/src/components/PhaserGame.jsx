import React, { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import HollowvaleScene from '../game/scenes/HollowvaleScene'

/**
 * Hosts the Phaser game. React overlays (HUD, chat, inventory) sit above this canvas.
 */
export default function PhaserGame({ className = '' }) {
  const containerRef = useRef(null)
  const gameRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return

    const config = {
      type: Phaser.AUTO,
      parent: containerRef.current,
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
    }

    const game = new Phaser.Game(config)
    gameRef.current = game

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true)
        gameRef.current = null
      }
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
