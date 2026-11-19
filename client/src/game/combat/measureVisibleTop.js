/**
 * First opaque row of a feet-anchored (or trimmed) runtime sheet.
 *
 * `hpBarVisibleTop` is a row in the source cell, counting from the top.
 * Untrimmed cells (the goblin family, wolf, cultist, revenant) store that
 * row directly. Trimmed cells (the red dragon) pack only the opaque
 * bounding box; the source-cell row is spriteSourceSize.y plus the row
 * inside the packed bitmap. Phaser sizes the sprite to sourceSize and
 * applies the atlas origin to that cell, so both kinds of sheet use the
 * same row.
 *
 * Living clips are idle, walk, attack and hurt. Arrow, impact and death
 * frames packed into the same atlas are not the body the health bar tracks.
 */

import { inflateSync } from 'node:zlib'
import { readFileSync } from 'node:fs'

const LIVING_ANIMS = new Set(['idle', 'walk', 'attack', 'hurt'])

/**
 * @param {Buffer} buf
 * @returns {{ width: number, height: number, rgba: Buffer }}
 */
export function decodePng(buf) {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) {
    throw new Error('not a png')
  }
  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let interlace = 0
  const idat = []
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset)
    const type = buf.toString('ascii', offset + 4, offset + 8)
    const data = buf.subarray(offset + 8, offset + 8 + length)
    offset += 12 + length
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
      interlace = data[12]
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
  }
  if (bitDepth !== 8 || interlace !== 0 || (colorType !== 6 && colorType !== 2 && colorType !== 0 && colorType !== 4)) {
    throw new Error(`unsupported png bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}`)
  }
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType]
  const stride = width * channels
  const inflated = inflateSync(Buffer.concat(idat))
  const expected = height * (stride + 1)
  if (inflated.length < expected) {
    throw new Error(`png inflate short: ${inflated.length} < ${expected}`)
  }
  const rgba = Buffer.alloc(width * height * 4)
  const prior = Buffer.alloc(stride)
  const row = Buffer.alloc(stride)
  let src = 0
  for (let y = 0; y < height; y++) {
    const filter = inflated[src++]
    inflated.copy(row, 0, src, src + stride)
    src += stride
    unfilter(filter, row, prior, channels)
    const dest = y * width * 4
    for (let x = 0; x < width; x++) {
      const i = x * channels
      if (channels === 4) {
        rgba[dest + x * 4] = row[i]
        rgba[dest + x * 4 + 1] = row[i + 1]
        rgba[dest + x * 4 + 2] = row[i + 2]
        rgba[dest + x * 4 + 3] = row[i + 3]
      } else if (channels === 3) {
        rgba[dest + x * 4] = row[i]
        rgba[dest + x * 4 + 1] = row[i + 1]
        rgba[dest + x * 4 + 2] = row[i + 2]
        rgba[dest + x * 4 + 3] = 255
      } else if (channels === 2) {
        rgba[dest + x * 4] = row[i]
        rgba[dest + x * 4 + 1] = row[i]
        rgba[dest + x * 4 + 2] = row[i]
        rgba[dest + x * 4 + 3] = row[i + 1]
      } else {
        rgba[dest + x * 4] = row[i]
        rgba[dest + x * 4 + 1] = row[i]
        rgba[dest + x * 4 + 2] = row[i]
        rgba[dest + x * 4 + 3] = 255
      }
    }
    row.copy(prior)
  }
  return { width, height, rgba }
}

function unfilter(filter, row, prior, channels) {
  const stride = row.length
  if (filter === 0) return
  if (filter === 1) {
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? row[i - channels] : 0
      row[i] = (row[i] + left) & 255
    }
    return
  }
  if (filter === 2) {
    for (let i = 0; i < stride; i++) row[i] = (row[i] + prior[i]) & 255
    return
  }
  if (filter === 3) {
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? row[i - channels] : 0
      row[i] = (row[i] + ((left + prior[i]) >> 1)) & 255
    }
    return
  }
  if (filter === 4) {
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? row[i - channels] : 0
      const up = prior[i]
      const upLeft = i >= channels ? prior[i - channels] : 0
      row[i] = (row[i] + paeth(left, up, upLeft)) & 255
    }
    return
  }
  throw new Error(`unsupported png filter ${filter}`)
}

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

/**
 * @param {string} frameName
 * @param {string} prefix asset id, e.g. 'goblin_archer'
 * @returns {string}
 */
export function frameAnim(frameName, prefix) {
  const head = `${prefix}_`
  const rest = frameName.startsWith(head) ? frameName.slice(head.length) : frameName
  return rest.split('_')[0]
}

/**
 * Highest opaque pixel (smallest source-cell row) across living frames.
 *
 * @param {string} pngPath
 * @param {string} jsonPath
 * @param {string} prefix
 * @param {{ anims?: Set<string>, alphaMin?: number }} [opts]
 * @returns {{ minRow: number|null, frameHeight: number|null, originY: number|null, trimmed: boolean, frames: number, trimMismatches: number, byAnim: Record<string, { row: number, frame: string }>, winner: { row: number, frame: string }|null }}
 */
export function measureSheetVisibleTop(pngPath, jsonPath, prefix, opts = {}) {
  const anims = opts.anims || LIVING_ANIMS
  const alphaMin = opts.alphaMin ?? 1
  const atlas = JSON.parse(readFileSync(jsonPath, 'utf8'))
  const image = decodePng(readFileSync(pngPath))
  const byAnim = {}
  let minRow = null
  let winner = null
  let frames = 0
  let trimmed = false
  let frameHeight = null
  let trimMismatches = 0
  const originY = atlas.meta?.origin?.y ?? null

  for (const [name, frame] of Object.entries(atlas.frames)) {
    const anim = frameAnim(name, prefix)
    if (!anims.has(anim)) continue
    if (frame.rotated) throw new Error(`${name} is rotated; measurement does not rotate samples`)
    frames += 1
    trimmed = trimmed || frame.trimmed === true
    const sourceH = frame.sourceSize?.h
    if (frameHeight == null) frameHeight = sourceH
    else if (frameHeight !== sourceH) {
      throw new Error(`${prefix} living frame ${name} source height ${sourceH} != ${frameHeight}`)
    }
    const row = firstOpaqueRow(image, frame, alphaMin)
    if (row == null) continue
    const trimY = frame.spriteSourceSize?.y
    if (frame.trimmed === true && trimY !== row) trimMismatches += 1
    const prev = byAnim[anim]
    if (!prev || row < prev.row) byAnim[anim] = { row, frame: name }
    if (minRow == null || row < minRow) {
      minRow = row
      winner = { row, frame: name }
    }
  }
  return { minRow, frameHeight, originY, trimmed, frames, trimMismatches, byAnim, winner }
}

function firstOpaqueRow(image, frame, alphaMin) {
  const cut = frame.frame
  const local = frame.spriteSourceSize || { x: 0, y: 0, w: cut.w, h: cut.h }
  const x0 = cut.x
  const y0 = cut.y
  const w = cut.w
  const h = cut.h
  for (let row = 0; row < h; row++) {
    const y = y0 + row
    if (y < 0 || y >= image.height) continue
    const line = y * image.width * 4
    for (let col = 0; col < w; col++) {
      const x = x0 + col
      if (x < 0 || x >= image.width) continue
      if (image.rgba[line + x * 4 + 3] >= alphaMin) {
        return local.y + row
      }
    }
  }
  return null
}
