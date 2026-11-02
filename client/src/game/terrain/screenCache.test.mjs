import assert from 'node:assert/strict'
import test from 'node:test'
import { clearCache, evictBeyond, getLayout } from './screenCache.js'
import { WORLD_NODES } from './worldGraph.js'

test('wilderness screens do not reshuffle between visits', () => {
  clearCache()
  const id = WORLD_NODES[0].id
  const first = getLayout(id)
  const second = getLayout(id)
  assert.equal(first, second)
  clearCache()
  const third = getLayout(id)
  assert.deepEqual(third, first)
  assert.notEqual(third, first)
  evictBeyond(id, 0)
  const fourth = getLayout(id)
  assert.deepEqual(fourth.tiles, first.tiles)
  assert.deepEqual(fourth.objects, first.objects)
  clearCache()
})
