import React, { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import MainGameScene from '../game/scenes/MainGameScene'
import { EventBus } from '../game/EventBus'

/**
 * React host for a Phaser 3 Game instance.
 * Owns create/destroy lifecycle; canvas fills the parent container.
 */
export default function PhaserGame({ className = '' }) {
  const containerRef = useRef(null)
  const gameRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return

    const config = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      backgroundColor: '#1c1917',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: window.innerWidth,
        height: window.innerHeight,
      },
      render: {
        pixelArt: true,
        antialias: false,
      },
      scene: [MainGameScene],
      audio: {
        disableWebAudio: false,
      },
    }

    const game = new Phaser.Game(config)
    gameRef.current = game

    EventBus.emit('game-ready', game)

    return () => {
      EventBus.emit('game-destroy')
      if (gameRef.current) {
        gameRef.current.destroy(true)
        gameRef.current = null
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={`phaser-game-host absolute inset-0 w-full h-full ${className}`}
      aria-label="Game canvas"
    />
  )
}
