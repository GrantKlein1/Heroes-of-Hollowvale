import { describe, it, expect, beforeEach } from 'vitest'
import { AttackTokenManager } from '../tokens.js'

describe('AttackTokenManager', () => {
  let manager

  beforeEach(() => {
    manager = new AttackTokenManager(2)
  })

  it('initializes with default maximum tokens of 2', () => {
    expect(manager.maxTokens).toBe(2)
    expect(manager.count).toBe(0)
  })

  it('allows enemies to acquire tokens up to maxTokens limit', () => {
    const enemy1 = { id: 1 }
    const enemy2 = { id: 2 }
    const enemy3 = { id: 3 }

    expect(manager.acquire(enemy1)).toBe(true)
    expect(manager.count).toBe(1)
    expect(manager.has(enemy1)).toBe(true)

    expect(manager.acquire(enemy2)).toBe(true)
    expect(manager.count).toBe(2)
    expect(manager.has(enemy2)).toBe(true)

    // 3rd enemy must be denied
    expect(manager.acquire(enemy3)).toBe(false)
    expect(manager.count).toBe(2)
    expect(manager.has(enemy3)).toBe(false)
  })

  it('returns true if the same enemy acquires repeatedly (idempotent)', () => {
    const enemy = { id: 'goblin_1' }
    expect(manager.acquire(enemy)).toBe(true)
    expect(manager.acquire(enemy)).toBe(true)
    expect(manager.count).toBe(1)
  })

  it('frees a token slot when released so another enemy can acquire', () => {
    const enemy1 = { id: 1 }
    const enemy2 = { id: 2 }
    const enemy3 = { id: 3 }

    manager.acquire(enemy1)
    manager.acquire(enemy2)
    expect(manager.acquire(enemy3)).toBe(false)

    expect(manager.release(enemy1)).toBe(true)
    expect(manager.count).toBe(1)
    expect(manager.has(enemy1)).toBe(false)

    // Now enemy3 can acquire
    expect(manager.acquire(enemy3)).toBe(true)
    expect(manager.count).toBe(2)
    expect(manager.has(enemy3)).toBe(true)
  })

  it('clears all tokens', () => {
    const enemy1 = { id: 1 }
    const enemy2 = { id: 2 }
    manager.acquire(enemy1)
    manager.acquire(enemy2)
    expect(manager.count).toBe(2)

    manager.clear()
    expect(manager.count).toBe(0)
    expect(manager.has(enemy1)).toBe(false)
    expect(manager.has(enemy2)).toBe(false)
  })

  it('handles null or undefined safely', () => {
    expect(manager.acquire(null)).toBe(false)
    expect(manager.release(null)).toBe(false)
    expect(manager.has(null)).toBe(false)
  })
})
