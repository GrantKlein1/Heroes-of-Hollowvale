import { describe, it, expect } from 'vitest'
import {
  CARDINAL_DIRECTIONS,
  buildAnimKey,
  parseAnimKey,
  buildFrameName,
  formatFrameDurations,
  buildFrameConfigs,
} from '../animKeys.js'

describe('animKeys — Key building and parsing', () => {
  it('builds directional animation keys matching <asset>_<anim>_<dir>', () => {
    expect(buildAnimKey('knight', 'walk', 'down')).toBe('knight_walk_down')
    expect(buildAnimKey('knight', 'attack', 'left')).toBe('knight_attack_left')
    expect(buildAnimKey('goblin_archer', 'attack', 'right')).toBe('goblin_archer_attack_right')
    expect(buildAnimKey('dwarf', 'dodge', 'up')).toBe('dwarf_dodge_up')
  })

  it('builds non-directional animation keys matching <asset>_<anim>', () => {
    expect(buildAnimKey('fx_common', 'hit_spark')).toBe('fx_common_hit_spark')
    expect(buildAnimKey('fx_common', 'dust_puff')).toBe('fx_common_dust_puff')
    expect(buildAnimKey('dragon_fx_v2', 'breath_burst')).toBe('dragon_fx_v2_breath_burst')
  })

  it('throws an error if asset or anim is missing', () => {
    expect(() => buildAnimKey('', 'walk', 'down')).toThrow()
    expect(() => buildAnimKey('knight', '', 'down')).toThrow()
  })

  it('parses directional animation keys into asset, anim, and dir', () => {
    const res = parseAnimKey('knight_walk_down')
    expect(res).toEqual({ asset: 'knight', anim: 'walk', dir: 'down' })
  })

  it('parses multi-word asset keys when knownAssets is supplied', () => {
    const known = ['goblin_archer', 'goblin_brute', 'knight', 'fx_common']
    const res = parseAnimKey('goblin_archer_attack_right', known)
    expect(res).toEqual({ asset: 'goblin_archer', anim: 'attack', dir: 'right' })

    const resBrute = parseAnimKey('goblin_brute_walk_up', known)
    expect(resBrute).toEqual({ asset: 'goblin_brute', anim: 'walk', dir: 'up' })
  })

  it('parses non-directional animation keys', () => {
    const known = ['fx_common', 'dragon_fx_v2']
    const res = parseAnimKey('fx_common_hit_spark', known)
    expect(res).toEqual({ asset: 'fx_common', anim: 'hit_spark', dir: null })
  })

  it('handles empty or non-string input safely in parseAnimKey', () => {
    expect(parseAnimKey('')).toEqual({ asset: '', anim: '', dir: null })
    expect(parseAnimKey(null)).toEqual({ asset: '', anim: '', dir: null })
  })
})

describe('animKeys — Template frame resolution', () => {
  it('resolves <dir> and <i> in frame template names', () => {
    expect(buildFrameName('knight_walk_<dir>_<i>', 'down', 3)).toBe('knight_walk_down_3')
    expect(buildFrameName('knight_attack_<dir>_<i>', 'left', 0)).toBe('knight_attack_left_0')
  })

  it('resolves templates that only contain <dir> (e.g. idle single frames)', () => {
    expect(buildFrameName('knight_idle_<dir>', 'up', 0)).toBe('knight_idle_up')
    expect(buildFrameName('goblin_archer_arrow_<dir>', 'right', 0)).toBe('goblin_archer_arrow_right')
  })

  it('resolves templates that only contain <i> (e.g. non-directional FX)', () => {
    expect(buildFrameName('fx_dust_puff_<i>', '', 2)).toBe('fx_dust_puff_2')
    expect(buildFrameName('goblin_archer_arrow_impact_<i>', '', 4)).toBe('goblin_archer_arrow_impact_4')
  })
})

describe('animKeys — Per-frame durations (Acceptance Criterion 1: Archer)', () => {
  it('formats archer attack variable durations', () => {
    const archerDurations = [120, 100, 100, 120, 250, 70, 100, 120]
    const formatted = formatFrameDurations(archerDurations, 8)
    expect(formatted).toEqual(archerDurations)
    expect(formatted).toHaveLength(8)
    expect(formatted[4]).toBe(250) // wind-up hold
    expect(formatted[5]).toBe(70)  // release snap
  })

  it('returns null if frameDurationsMs is missing or empty', () => {
    expect(formatFrameDurations(null, 8)).toBeNull()
    expect(formatFrameDurations([], 8)).toBeNull()
  })

  it('builds Phaser animation frame configs with exact per-frame durations for archer', () => {
    const archerDurations = [120, 100, 100, 120, 250, 70, 100, 120]
    const configs = buildFrameConfigs({
      atlasKey: 'goblin_archer',
      frameNames: 'goblin_archer_attack_<dir>_<i>',
      frameCount: 8,
      dir: 'right',
      frameDurationsMs: archerDurations,
    })

    expect(configs).toHaveLength(8)
    expect(configs[0]).toEqual({
      key: 'goblin_archer',
      frame: 'goblin_archer_attack_right_0',
      duration: 120,
    })
    expect(configs[4]).toEqual({
      key: 'goblin_archer',
      frame: 'goblin_archer_attack_right_4',
      duration: 250,
    })
    expect(configs[5]).toEqual({
      key: 'goblin_archer',
      frame: 'goblin_archer_attack_right_5',
      duration: 70,
    })
    expect(configs[7]).toEqual({
      key: 'goblin_archer',
      frame: 'goblin_archer_attack_right_7',
      duration: 120,
    })
  })

  it('builds standard frame configs without duration property when frameDurationsMs is absent', () => {
    const configs = buildFrameConfigs({
      atlasKey: 'knight',
      frameNames: 'knight_walk_<dir>_<i>',
      frameCount: 4,
      dir: 'down',
    })

    expect(configs).toHaveLength(4)
    expect(configs[0]).toEqual({
      key: 'knight',
      frame: 'knight_walk_down_0',
    })
    expect(configs[0].duration).toBeUndefined()
  })
})
