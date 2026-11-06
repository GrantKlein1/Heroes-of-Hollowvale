import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  applyHitStop,
  applyFlash,
  applyKnockback,
  spawnHitSpark,
  spawnDustPuff,
  isPlayerInvulnerable,
  setPlayerInvulnerable,
  isEnemyHitOnSwing,
  recordEnemyHitOnSwing,
  HIT_STOP_DURATION_MS,
  PLAYER_IFRAME_DURATION_MS,
  ENEMY_PER_SWING_IFRAME_MS,
} from '../feedback.js'

describe('Combat Feedback System (feedback.js)', () => {
  let mockScene

  beforeEach(() => {
    vi.useFakeTimers()
    mockScene = {
      time: {
        delayedCall: vi.fn((ms, cb) => {
          setTimeout(cb, ms)
        }),
      },
      add: {
        sprite: vi.fn((x, y, tex) => ({
          x,
          y,
          texture: { key: tex },
          setOrigin: vi.fn().mockReturnThis(),
          setDepth: vi.fn().mockReturnThis(),
          anims: {
            play: vi.fn(),
          },
          once: vi.fn(),
          destroy: vi.fn(),
        })),
      },
    }
  })

  describe('applyHitStop', () => {
    it('pauses active animations and freezes velocity for 60 ms, then resumes', () => {
      const attacker = {
        scene: mockScene,
        anims: {
          isPlaying: true,
          pause: vi.fn(),
          resume: vi.fn(),
        },
        body: {
          velocity: { x: 50, y: 0 },
          setVelocity: vi.fn((x, y) => {
            attacker.body.velocity.x = x
            attacker.body.velocity.y = y
          }),
        },
      }

      applyHitStop(attacker, HIT_STOP_DURATION_MS)

      expect(attacker.anims.pause).toHaveBeenCalledTimes(1)
      expect(attacker.body.setVelocity).toHaveBeenCalledWith(0, 0)

      // Fast-forward past hit-stop
      vi.advanceTimersByTime(HIT_STOP_DURATION_MS)

      expect(attacker.anims.resume).toHaveBeenCalledTimes(1)
      expect(attacker.body.setVelocity).toHaveBeenCalledWith(50, 0)
    })
  })

  describe('applyFlash', () => {
    it('applies white flash for 60 ms, transitions to red flash, then clears', () => {
      const target = {
        scene: mockScene,
        setTintFill: vi.fn(),
        setTint: vi.fn(),
        clearTint: vi.fn(),
      }

      applyFlash(target, mockScene, { whiteMs: 60, redMs: 120 })

      // Stage 1: Solid white
      expect(target.setTintFill).toHaveBeenCalledWith(0xffffff)

      // Advance 60 ms -> Stage 2: Red
      vi.advanceTimersByTime(60)
      expect(target.setTint).toHaveBeenCalledWith(0xff4444)

      // Advance another 120 ms -> Stage 3: Clear
      vi.advanceTimersByTime(120)
      expect(target.clearTint).toHaveBeenCalledTimes(1)
    })
  })

  describe('applyKnockback', () => {
    it('pushes target body away from impact point and resets after duration', () => {
      const target = {
        scene: mockScene,
        x: 100,
        y: 100,
        body: {
          bottom: 110,
          setVelocity: vi.fn(),
        },
      }

      // Attacker is at (80, 100) -> knockback pushes target along +X
      applyKnockback(target, 80, 100, 140, 150)

      expect(target.body.setVelocity).toHaveBeenCalledWith(140, 0)
      expect(mockScene.add.sprite).toHaveBeenCalledWith(100, 110, 'fx_common')

      vi.advanceTimersByTime(150)
      expect(target.body.setVelocity).toHaveBeenCalledWith(0, 0)
    })
  })

  describe('spawnHitSpark & spawnDustPuff', () => {
    it('spawns hit_spark centered at impact point and records lastFx', () => {
      const spark = spawnHitSpark(mockScene, 150, 200)

      expect(mockScene.add.sprite).toHaveBeenCalledWith(150, 200, 'fx_common')
      expect(spark.setOrigin).toHaveBeenCalledWith(0.5, 0.5)
      expect(spark.setDepth).toHaveBeenCalledWith(20000)
      expect(spark.anims.play).toHaveBeenCalledWith('fx_common_hit_spark')
      expect(mockScene._lastFx).toBe('fx_common_hit_spark')
    })

    it('spawns dust_puff at bottom-center on feet', () => {
      const dust = spawnDustPuff(mockScene, 120, 180)

      expect(mockScene.add.sprite).toHaveBeenCalledWith(120, 180, 'fx_common')
      expect(dust.setOrigin).toHaveBeenCalledWith(0.5, 1.0)
      expect(dust.anims.play).toHaveBeenCalledWith('fx_common_dust_puff')
    })
  })

  describe('I-Frames & Per-Swing Protection', () => {
    it('enforces 600 ms player i-frames', () => {
      const player = { invulnerableUntil: 0 }
      const t0 = 1000

      expect(isPlayerInvulnerable(player, t0)).toBe(false)

      setPlayerInvulnerable(player, t0, PLAYER_IFRAME_DURATION_MS)
      expect(player.invulnerableUntil).toBe(1600)

      // 300 ms later: still invulnerable
      expect(isPlayerInvulnerable(player, 1300)).toBe(true)

      // 601 ms later: invulnerability expired
      expect(isPlayerInvulnerable(player, 1601)).toBe(false)
    })

    it('enforces 200 ms enemy per-swing i-frames', () => {
      const enemy = { _lastHitSwingId: null, perSwingIFrameUntil: 0 }
      const swing1 = 1
      const t0 = 2000

      expect(isEnemyHitOnSwing(enemy, swing1, t0)).toBe(false)

      recordEnemyHitOnSwing(enemy, swing1, t0, ENEMY_PER_SWING_IFRAME_MS)
      expect(enemy._lastHitSwingId).toBe(1)
      expect(enemy.perSwingIFrameUntil).toBe(2200)

      // Same swing at t = 2050 ms is blocked
      expect(isEnemyHitOnSwing(enemy, swing1, 2050)).toBe(true)

      // Another swing at t = 2100 ms is also within 200 ms window
      expect(isEnemyHitOnSwing(enemy, 2, 2100)).toBe(true)

      // After 200 ms window passes (t = 2250 ms), new swing is permitted
      expect(isEnemyHitOnSwing(enemy, 2, 2250)).toBe(false)
    })
  })
})

