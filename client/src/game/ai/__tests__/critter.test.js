import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  CRITTER_CONFIGS,
  CRITTER_STATES,
  resolveCritterFacing,
  buildCritterAnimKey,
  ensureCritterAnimations,
  Critter,
} from '../critter.js'

describe('Ambient Critters AI — Package 1b-4', () => {
  describe('Direction Resolution & Facing Selection', () => {
    it('selects left/right for horizontally dominant movement', () => {
      expect(resolveCritterFacing(-10, 2)).toBe('left')
      expect(resolveCritterFacing(10, -2)).toBe('right')
    })

    it('selects up/down for vertically dominant movement when manifest has them', () => {
      const dirs = ['left', 'right', 'up', 'down']
      expect(resolveCritterFacing(2, -10, dirs)).toBe('up')
      expect(resolveCritterFacing(-2, 10, dirs)).toBe('down')
    })

    it('falls back to left/right when vertical clips are not available (ASSET_SPEC Phase 1 rules)', () => {
      const dirsOnlyLR = ['left', 'right']
      expect(resolveCritterFacing(2, -10, dirsOnlyLR)).toBe('right')
      expect(resolveCritterFacing(-2, 10, dirsOnlyLR)).toBe('left')
    })

    it('maps vertical idle/alert anim keys to horizontal facings', () => {
      // Idle and Alert do not have up/down in Phase 1
      expect(buildCritterAnimKey('squirrel_red', 'idle', 'up')).toBe('squirrel_red_idle_right')
      expect(buildCritterAnimKey('squirrel_red', 'idle', 'down')).toBe('squirrel_red_idle_left')
      expect(buildCritterAnimKey('bird_sparrow', 'idle', 'left')).toBe('bird_sparrow_idle_left')

      // Run / Fly / Scurry DO have up and down
      expect(buildCritterAnimKey('squirrel_red', 'run', 'up')).toBe('squirrel_red_run_up')
      expect(buildCritterAnimKey('squirrel_red', 'run', 'down')).toBe('squirrel_red_run_down')
      expect(buildCritterAnimKey('bird_sparrow', 'fly', 'up')).toBe('bird_sparrow_fly_up')
      expect(buildCritterAnimKey('rat_grey', 'scurry', 'down')).toBe('rat_grey_scurry_down')
    })
  })

  describe('Critter Flee Behavior', () => {
    let mockScene

    beforeEach(() => {
      mockScene = {
        player: { x: 100, y: 100 },
        anims: {
          exists: vi.fn(() => true),
          create: vi.fn(),
        },
      }
    })

    it('remains in IDLE when player is outside alert radius', () => {
      // Critter is 300px away from player (100, 100)
      const critter = new Critter(mockScene, 400, 100, 'squirrel_red')
      critter.update(1000, 16)

      expect(critter.state).toBe(CRITTER_STATES.IDLE)
      expect(critter.vx).toBe(0)
      expect(critter.vy).toBe(0)
      expect(critter.lastAnimKey).toBe('squirrel_red_idle_right')
    })

    it('transitions to ALERT then FLEE when player enters alert radius', () => {
      // Red squirrel alert radius is 100px. Place critter at (160, 100) -> 60px away
      const critter = new Critter(mockScene, 160, 100, 'squirrel_red')
      critter.update(1000, 16)

      expect(critter.state).toBe(CRITTER_STATES.ALERT)
      expect(critter.lastAnimKey).toBe('squirrel_red_alert_right')

      // After alert duration (250ms), transitions to FLEE
      critter.update(1300, 16)
      expect(critter.state).toBe(CRITTER_STATES.FLEE)
      expect(critter.vx).toBeGreaterThan(0) // Moves right (away from player at 100)
      expect(critter.facing).toBe('right')
      expect(critter.lastAnimKey).toBe('squirrel_red_run_right')
    })

    it('flees upward when player approaches from below', () => {
      // Player is at (100, 150), bird is at (100, 100) -> dy = -50 (upward escape)
      mockScene.player = { x: 100, y: 150 }
      const bird = new Critter(mockScene, 100, 100, 'bird_sparrow')

      bird.update(1000, 16)
      expect(bird.state).toBe(CRITTER_STATES.FLEE)
      expect(bird.vy).toBeLessThan(0) // Negative Y is up
      expect(bird.facing).toBe('up')
      expect(bird.lastAnimKey).toBe('bird_sparrow_fly_up')
    })

    it('flees downward when player approaches from above', () => {
      // Player is at (100, 50), rat is at (100, 100) -> dy = +50 (downward escape)
      mockScene.player = { x: 100, y: 50 }
      const rat = new Critter(mockScene, 100, 100, 'rat_grey')

      rat.update(1000, 16)
      expect(rat.state).toBe(CRITTER_STATES.FLEE)
      expect(rat.vy).toBeGreaterThan(0) // Positive Y is down
      expect(rat.facing).toBe('down')
      expect(rat.lastAnimKey).toBe('rat_grey_scurry_down')
    })

    it('returns to IDLE once it has escaped beyond escape radius', () => {
      const critter = new Critter(mockScene, 160, 100, 'squirrel_grey')
      critter.state = CRITTER_STATES.FLEE

      // Player teleports far away
      mockScene.player = { x: 900, y: 900 }
      critter.update(1000, 16)

      expect(critter.state).toBe(CRITTER_STATES.IDLE)
      expect(critter.vx).toBe(0)
      expect(critter.vy).toBe(0)
      expect(critter.lastAnimKey).toBe('squirrel_grey_idle_right')
    })
  })
})
