import { describe, it, expect, vi } from 'vitest'
import {
  KNOWN_MISSING_CLIPS,
  isProvenMissingClip,
  resolveAnimWithFallback,
  applyGenericTelegraph,
  applyGenericAlert,
} from '../fallbacks.js'

describe('Combat Fallbacks — Package 4-1', () => {
  it('registers goblin family alert clips as proven missing', () => {
    expect(KNOWN_MISSING_CLIPS).toContain('goblin_alert')
    expect(KNOWN_MISSING_CLIPS).toContain('goblin_archer_alert')
    expect(KNOWN_MISSING_CLIPS).toContain('goblin_brute_alert')

    expect(isProvenMissingClip('goblin_alert_down')).toBe(true)
    expect(isProvenMissingClip('goblin_archer_alert_right')).toBe(true)
    expect(isProvenMissingClip('goblin_brute_alert_up')).toBe(true)

    // Delivered clips must NOT be registered as missing
    expect(isProvenMissingClip('knight_run_down')).toBe(false)
    expect(isProvenMissingClip('knight_attack_2_down')).toBe(false)
    expect(isProvenMissingClip('knight_charge_hold_down')).toBe(false)
    expect(isProvenMissingClip('knight_charged_release_down')).toBe(false)
    expect(isProvenMissingClip('goblin_spawn_down')).toBe(false)
  })

  it('resolves desiredKey when it exists in scene.anims', () => {
    const mockScene = {
      anims: {
        exists: vi.fn((key) => key === 'knight_attack_2_down'),
      },
    }
    const resolved = resolveAnimWithFallback(mockScene, 'knight_attack_2_down', 'knight_attack_down')
    expect(resolved).toBe('knight_attack_2_down')
  })

  it('resolves fallbackKey when desiredKey is missing but fallbackKey exists', () => {
    const mockScene = {
      anims: {
        exists: vi.fn((key) => key === 'goblin_telegraph_down'),
      },
    }
    const resolved = resolveAnimWithFallback(mockScene, 'goblin_alert_down', 'goblin_telegraph_down')
    expect(resolved).toBe('goblin_telegraph_down')
  })

  it('returns null when neither desiredKey nor fallbackKey exists', () => {
    const mockScene = {
      anims: {
        exists: vi.fn(() => false),
      },
    }
    const resolved = resolveAnimWithFallback(mockScene, 'goblin_archer_alert_down', 'goblin_archer_telegraph_down')
    expect(resolved).toBeNull()
  })

  it('applies procedural alert tint and cleans up via delayedCall', () => {
    let delayedCb = null
    const mockActor = {
      active: true,
      setTint: vi.fn(),
      clearTint: vi.fn(),
      scene: {
        time: {
          delayedCall: vi.fn((ms, cb) => {
            delayedCb = cb
          }),
        },
      },
    }

    applyGenericAlert(mockActor, 250, 0xffee66)
    expect(mockActor.setTint).toHaveBeenCalledWith(0xffee66)
    expect(mockActor.scene.time.delayedCall).toHaveBeenCalledWith(250, expect.any(Function))

    // Invoke delayed callback
    delayedCb()
    expect(mockActor.clearTint).toHaveBeenCalled()
  })
})
