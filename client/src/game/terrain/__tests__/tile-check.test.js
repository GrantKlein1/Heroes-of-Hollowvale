import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// @ts-ignore plain ESM tool script shared with `npm run assets:check-tiles`
import { checkTiles, expectedImageSize } from '../../../../../tools/assets/check_tiles.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..')
const REAL_TILES = path.join(ROOT, 'client/public/assets/tiles')

const tmpDirs = []

/** Copies every tsj + png to a temp dir so a test can edit them. */
function copyTiles() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hv-tiles-'))
  tmpDirs.push(dir)
  for (const f of fs.readdirSync(REAL_TILES)) {
    fs.copyFileSync(path.join(REAL_TILES, f), path.join(dir, f))
  }
  return dir
}

function editTsj(dir, name, fn) {
  const file = path.join(dir, `${name}.tsj`)
  const tsj = JSON.parse(fs.readFileSync(file, 'utf8'))
  fn(tsj)
  fs.writeFileSync(file, JSON.stringify(tsj, null, 2))
}

afterEach(() => {
  while (tmpDirs.length) fs.rmSync(tmpDirs.pop(), { recursive: true, force: true })
})

describe('tile swap check (tools/assets/check_tiles.mjs)', () => {
  it('passes on the current tree', async () => {
    const result = await checkTiles({ root: ROOT })
    expect(result.errors).toEqual([])
    expect(result.ok).toBe(true)
    expect(result.tilesetCount).toBeGreaterThan(0)
  })

  it('computes the margin/spacing image size', () => {
    expect(expectedImageSize({ tilewidth: 32, tileheight: 32, columns: 4, tilecount: 8, margin: 1, spacing: 2 })).toEqual({
      rows: 2,
      width: 136,
      height: 68,
    })
  })

  it('fails when a collides flag changes', async () => {
    const dir = copyTiles()
    editTsj(dir, 'grass', (tsj) => {
      const prop = tsj.tiles[0].properties.find((p) => p.name === 'collides')
      prop.value = true
    })
    const { ok, errors } = await checkTiles({ root: ROOT, tilesDir: dir })
    expect(ok).toBe(false)
    expect(errors.join('\n')).toMatch(/grass: collides: baseline \[\] -> now \[0\]/)
  })

  it('fails when a tilecount changes', async () => {
    const dir = copyTiles()
    editTsj(dir, 'dirt_road', (tsj) => {
      tsj.tilecount = 12
    })
    const { ok, errors } = await checkTiles({ root: ROOT, tilesDir: dir })
    expect(ok).toBe(false)
    const text = errors.join('\n')
    expect(text).toMatch(/dirt_road: tilecount: baseline 24 -> now 12/)
    expect(text).toMatch(/dirt_road: png is/)
  })

  it('fails when a png does not match the layout math', async () => {
    const dir = copyTiles()
    editTsj(dir, 'water_ford', (tsj) => {
      tsj.spacing = 0
    })
    const { ok, errors } = await checkTiles({ root: ROOT, tilesDir: dir })
    expect(ok).toBe(false)
    expect(errors.join('\n')).toMatch(/water_ford: png is .* layout math says/)
  })

  it('fails when a tileset used by a map has no tsj', async () => {
    const dir = copyTiles()
    fs.rmSync(path.join(dir, 'cobble_road.tsj'))
    fs.rmSync(path.join(dir, 'cobble_road.png'))
    const { ok, errors } = await checkTiles({ root: ROOT, tilesDir: dir })
    expect(ok).toBe(false)
    expect(errors.join('\n')).toMatch(/cobble_road: used by maps\/.* but there is no cobble_road\.tsj/)
  })
})
