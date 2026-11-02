/**
 * Hand-tuned 16×16 painters. Light comes from the top-left.
 * Dual-grid edges are a hard fillet plus a 1px outline, not a dither band.
 */
import { DUAL_ROWS, SHEET_COLS, T } from '../src/game/world/tileCatalog.js'

function clamp(n) {
  return n < 0 ? 0 : n > 255 ? 255 : n
}
function rgba(r, g, b, a = 255) {
  return [r, g, b, a]
}
function add(c, d) {
  return rgba(clamp(c[0] + d), clamp(c[1] + d), clamp(c[2] + d), c[3] ?? 255)
}
function mix(a, b, t) {
  return rgba(
    clamp(a[0] + (b[0] - a[0]) * t),
    clamp(a[1] + (b[1] - a[1]) * t),
    clamp(a[2] + (b[2] - a[2]) * t),
    a[3] ?? 255,
  )
}
const CLEAR = rgba(0, 0, 0, 0)

function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}

function grass(x, y, variant = 0) {
  const n = hash(x, y, 3) & 7
  let c = n < 5 ? rgba(44, 112, 40) : n < 7 ? rgba(34, 90, 32) : rgba(58, 132, 48)
  c = add(c, 7 - Math.floor((x + y) / 5))
  if ((x + y * 3) % 11 === 0) c = add(c, -8)
  if (x < 2 || y < 2 || x > 13 || y > 13) return c
  const spots = [
    [[4, 5], [11, 8], [7, 12]],
    [[5, 4], [9, 10], [12, 6], [6, 13]],
    [[3, 8], [8, 5], [10, 12]],
    [[6, 7], [12, 11]],
  ][variant] || []
  for (const [sx, sy] of spots) {
    if (x === sx && y === sy) return rgba(186, 214, 86)
    if (x === sx && y === sy + 1) return rgba(22, 78, 24)
    if (x === sx && y === sy - 1) return rgba(120, 168, 64)
  }
  if (variant === 1 && x === 8 && y === 9) return rgba(236, 228, 210)
  if (variant === 1 && (x === 7 || x === 9) && y === 9) return rgba(220, 170, 70)
  if (variant === 2 && x === 10 && y === 7) return rgba(120, 116, 108)
  if (variant === 2 && x === 11 && y === 7) return rgba(78, 74, 68)
  if (variant === 3 && x === 5 && y === 6) return rgba(210, 86, 120)
  if (variant === 3 && x === 5 && y === 7) return rgba(40, 100, 36)
  return c
}

function plains(x, y, variant = 0) {
  const n = hash(x, y, 9) & 7
  let c = n < 4 ? rgba(128, 140, 64) : n < 6 ? rgba(108, 118, 52) : rgba(150, 156, 78)
  c = add(c, 4 - Math.floor(y / 6))
  if (x % 5 === 1 && y % 4 !== 0) c = add(c, -12)
  if (x < 2 || y < 2 || x > 13 || y > 13) return c
  if (variant > 0) {
    const blades = [[4, 6], [8, 4], [12, 8], [6, 12], [11, 11]]
    for (const [sx, sy] of blades) {
      if (x === sx && y >= sy && y <= sy + 2 && (variant + sx) % 2 === 0) return rgba(86, 110, 40)
      if (x === sx && y === sy - 1) return rgba(168, 176, 84)
    }
  }
  if (variant === 2 && x === 9 && y === 10) return rgba(196, 168, 72)
  return c
}

function forest(x, y, variant = 0) {
  const n = hash(x, y, 5) & 7
  let c = n < 4 ? rgba(20, 58, 28) : n < 6 ? rgba(14, 42, 22) : rgba(32, 72, 34)
  if ((x * 3 + y) % 7 === 0) c = rgba(46, 36, 22)
  if ((x + y * 5) % 9 === 0) c = rgba(28, 64, 30)
  c = add(c, 3 - Math.floor((x + y) / 8))
  if (x < 2 || y < 2 || x > 13 || y > 13) return c
  if (variant === 1 && y > 6 && y < 12 && (x === 4 || x === 5)) return x === 4 ? rgba(78, 52, 30) : rgba(48, 32, 18)
  if (variant === 1 && y === 8 && x > 3 && x < 10) return rgba(62, 40, 22)
  if (variant === 2 && x > 6 && x < 11 && y > 5 && y < 11 && (x + y) % 2 === 0) return rgba(36, 110, 48)
  if (variant === 2 && x === 8 && y === 7) return rgba(150, 40, 36)
  return c
}

function water(x, y, frame = 0) {
  const shift = frame * 2
  const wave = (x + shift + y * 3) % 8
  let c = wave < 2 ? rgba(58, 124, 158) : wave < 5 ? rgba(36, 86, 124) : rgba(28, 70, 108)
  if (y % 5 === (1 + frame) % 5 && (x + shift) % 7 === 3) c = rgba(186, 224, 226)
  if (x + y < 6) c = add(c, 10)
  if (y > 12) c = add(c, -8)
  return c
}

function road(x, y) {
  const ox = (Math.floor(y / 8) % 2) * 4
  const sx = (x + ox) % 8
  const sy = y % 8
  if (sx === 0 || sy === 0) return rgba(58, 38, 24)
  const tone = ((Math.floor((x + ox) / 8) + Math.floor(y / 8) * 2) % 3) * 10
  let c = rgba(124 + tone, 96 + Math.floor(tone / 2), 74)
  if (sx < 3 && sy < 3) c = add(c, 22)
  else if (sx > 5 || sy > 5) c = add(c, -18)
  if (x === 6 || x === 7 || x === 9) c = add(c, -14)
  if (y % 6 === 0 && x > 4 && x < 12) c = add(c, -8)
  return c
}

function cobble(x, y, variant = 0) {
  const sx = x % 5
  const sy = (y + (variant === 1 ? 2 : 0)) % 4
  if (sx === 0 || sy === 0) return rgba(54, 48, 42)
  let c = ((x + y) & 2) ? rgba(148, 136, 118) : rgba(112, 102, 90)
  if (sx < 2 && sy < 2) c = add(c, 16)
  else if (sy > 2) c = add(c, -12)
  if (variant === 2 && x === 7 && y === 8) return rgba(90, 82, 70)
  return c
}

function wall(x, y, variant = 0) {
  const period = variant === 1 ? 5 : 4
  const sx = x % period
  if (sx === period - 1) return rgba(32, 22, 14)
  let c = rgba(118, 78, 42)
  if (sx === 0) c = add(c, 26)
  if (sx === 2) c = add(c, -14)
  if (y < 2) c = add(c, 18)
  if (y === 2 && sx !== period - 1) c = rgba(86, 90, 70)
  if (y > 13) c = add(c, -16)
  if (variant === 2 && y < 4 && sx === 1) c = rgba(168, 160, 140)
  if (variant === 3 && (y === 6 || y === 10)) c = rgba(92, 64, 36)
  return c
}

function roof(x, y, chimney = false) {
  const stripe = (x + Math.floor(y / 2)) % 3
  let c = stripe === 0 ? rgba(168, 78, 48) : stripe === 2 ? rgba(96, 36, 28) : rgba(132, 54, 36)
  if (y < 2) c = add(c, 22)
  if (y > 13) c = add(c, -18)
  if ((x + y) % 4 === 0) c = add(c, 8)
  if (chimney && x > 5 && x < 11 && y > 2 && y < 12) {
    if (x === 6 || x === 10 || y === 3 || y === 11) return rgba(48, 32, 28)
    let brick = ((x + y) & 1) ? rgba(120, 72, 64) : rgba(96, 56, 50)
    if (x < 8 && y < 7) brick = add(brick, 16)
    return brick
  }
  return c
}

function bwall(x, y, door = false) {
  if (x < 2 || x > 13 || y < 2 || y > 13) {
    const timber = wall(x < 2 ? 0 : 2, y)
    return timber
  }
  if (door && x > 5 && x < 11 && y > 3) {
    if (x === 6 || x === 10) return rgba(48, 30, 16)
    let d = rgba(92, 56, 30)
    if (x < 8) d = add(d, 14)
    if (y === 8) d = rgba(160, 132, 64)
    return d
  }
  if (!door && x > 4 && x < 11 && y > 4 && y < 10) {
    if (x === 5 || x === 10 || y === 5 || y === 9) return rgba(42, 28, 18)
    if (x < 8 && y < 7) return rgba(150, 186, 196)
    return rgba(72, 108, 128)
  }
  let c = rgba(176, 156, 118)
  if (x + y < 10) c = add(c, 12)
  if (x + y > 20) c = add(c, -14)
  if (y === 8) return rgba(110, 74, 40)
  return c
}

function thicket(x, y) {
  let c = forest(x, y, 0)
  if ((x * 2 + y) % 4 === 0) c = rgba(12, 28, 14)
  if ((x + y * 2) % 5 === 1) c = rgba(40, 28, 16)
  if (x % 4 === 0 && y > 3) c = rgba(28, 18, 10)
  return c
}

function ford(x, y) {
  const sx = x % 8
  const sy = y % 8
  if (sx > 1 && sx < 6 && sy > 2 && sy < 7) return road(x, y)
  return mix(water(x, y, 0), rgba(86, 110, 78), 0.45)
}

function bridge(x, y) {
  if (y < 2 || y > 13) return water(x, y, 0)
  if (y % 4 === 0) return rgba(54, 34, 18)
  let c = rgba(142, 96, 52)
  if (x < 3) c = add(c, 18)
  if (x > 12) c = add(c, -16)
  if (x === 1 || x === 14) return rgba(78, 52, 28)
  return c
}

function gate(side, x, y) {
  const post = side === 'L' ? x < 5 : x > 10
  if (y < 3) return y === 0 ? rgba(70, 64, 58) : rgba(120, 84, 48)
  if (post) {
    if (x === 0 || x === 15 || (side === 'L' && x === 4) || (side === 'R' && x === 11)) return rgba(42, 28, 16)
    let c = rgba(108, 72, 40)
    if ((side === 'L' && x < 2) || (side === 'R' && x > 13)) c = add(c, 20)
    if (y === 6 || y === 11) return rgba(150, 138, 110)
    return c
  }
  return road(x, y)
}

function canopy(v, x, y) {
  const specs = [
    { cx: 8, cy: 8, rx: 7.2, ry: 6.4, leaf: rgba(22, 96, 34), hi: rgba(78, 150, 52), sh: rgba(10, 48, 20) },
    { cx: 8, cy: 9, rx: 6.2, ry: 7.2, leaf: rgba(16, 72, 40), hi: rgba(40, 110, 58), sh: rgba(8, 36, 22) },
    { cx: 7, cy: 8, rx: 6.8, ry: 6.2, leaf: rgba(48, 110, 40), hi: rgba(150, 176, 78), sh: rgba(28, 64, 24) },
    { cx: 8, cy: 8, rx: 6.4, ry: 5.8, leaf: rgba(54, 62, 36), hi: rgba(110, 100, 64), sh: rgba(32, 28, 18) },
  ][v]
  const dx = (x - specs.cx) / specs.rx
  const dy = (y - specs.cy) / specs.ry
  const d2 = dx * dx + dy * dy
  if (d2 > 1) return CLEAR
  if (d2 > 0.92) return add(specs.sh, -10)
  let c = specs.leaf
  if (dx + dy < -0.35) c = specs.hi
  else if (dx + dy > 0.55) c = specs.sh
  if (hash(x, y, v + 2) % 11 === 0) c = add(c, -12)
  if (hash(x, y, v + 8) % 13 === 0) c = add(c, 14)
  if (v === 1 && x % 3 === 0 && y % 4 === 1 && d2 < 0.7) c = add(specs.sh, 6)
  return c
}

function trunk(v, x, y) {
  const left = [5, 6, 5, 4][v]
  const right = [10, 10, 9, 11][v]
  if (y > 12 && x > 3 && x < 12) {
    const shade = x < 8 ? 28 : 8
    return rgba(0, 0, 0, 70 + shade)
  }
  if (x < left || x > right) return CLEAR
  let c = [rgba(102, 68, 38), rgba(86, 58, 34), rgba(140, 124, 96), rgba(72, 48, 32)][v]
  if (x === left) c = add(c, 22)
  if (x === right) c = add(c, -18)
  if (hash(x, y, v) % 5 === 0) c = add(c, -10)
  if (v === 2 && y % 3 === 0) c = add(c, 16)
  if (v === 1 && x === left + 2 && y % 4 === 2) c = rgba(36, 70, 32)
  return c
}

function bush(x, y, v) {
  const dx = x - 8
  const dy = y - 10
  const r = 5.2 + (v % 2)
  if (dx * dx + dy * dy > r * r || y < 6) return CLEAR
  if (y > 13 && Math.abs(dx) < 4) return rgba(0, 0, 0, 60)
  let c = v % 2 ? rgba(24, 86, 32) : rgba(36, 104, 40)
  if (dx + dy < 0) c = add(c, 16)
  else c = add(c, -12)
  return c
}

function rock(x, y, v) {
  const dx = x - 8
  const dy = y - 9
  const r2 = dx * dx * 0.85 + dy * dy
  if (r2 > 30 + v || y < 4) return CLEAR
  if (y > 13) return rgba(0, 0, 0, 55)
  let c = rgba(118, 116, 112)
  if (dx < -1 && dy < 1) c = add(c, 28)
  else if (dx > 1 || dy > 2) c = add(c, -24)
  if (hash(x, y, v) % 8 === 0) c = rgba(70, 104, 52)
  return c
}

function logPix(x, y) {
  if (y < 8 || y > 13 || x < 1 || x > 14) return CLEAR
  if (y > 13) return CLEAR
  if (y === 8) return rgba(0, 0, 0, 40)
  if (y === 13 || x === 1 || x === 14) return rgba(48, 30, 16)
  let c = rgba(124, 82, 44)
  if (y < 11) c = add(c, 12)
  if (x % 4 === 0) c = add(c, -16)
  return c
}

function barrel(x, y) {
  if (x < 4 || x > 11 || y < 4 || y > 14) return CLEAR
  if (y === 14) return rgba(0, 0, 0, 50)
  const dx = Math.abs(x - 7.5)
  if (dx > 3.2 - (y < 6 || y > 12 ? 1 : 0)) return CLEAR
  let c = rgba(132, 86, 44)
  if (x < 7) c = add(c, 16)
  if (y === 6 || y === 11) c = rgba(70, 48, 28)
  return c
}

function cart(x, y) {
  if (y > 13 && x > 2 && x < 14) return rgba(0, 0, 0, 50)
  if (y > 8 && y < 13 && x > 1 && x < 14) {
    if (y === 9 || x === 2 || x === 13) return rgba(54, 34, 18)
    return x < 8 ? rgba(140, 92, 48) : rgba(96, 62, 32)
  }
  if ((x === 4 || x === 11) && y > 10 && y < 15) return rgba(70, 70, 74)
  if (y === 5 && x > 6 && x < 12) return rgba(120, 40, 28)
  return CLEAR
}

function hay(x, y) {
  if (x < 3 || x > 12 || y < 6 || y > 14) return CLEAR
  if (y === 14) return rgba(0, 0, 0, 45)
  let c = ((x + y) % 3 === 0) ? rgba(186, 156, 64) : rgba(154, 124, 48)
  if (y < 8) c = add(c, 16)
  if (x < 5) c = add(c, 8)
  return c
}

function campfire(x, y) {
  if (y > 12 && x > 4 && x < 12) return rgba(0, 0, 0, 40)
  const dx = x - 8
  const dy = y - 9
  if (dx * dx + dy * dy < 6 && y < 10) return y < 7 ? rgba(236, 196, 72) : rgba(186, 64, 28)
  if (Math.abs(dx) + Math.abs(dy) < 6 && y > 7) return rgba(72, 68, 64)
  return CLEAR
}

function crate(x, y) {
  if (x < 3 || x > 12 || y < 5 || y > 14) return CLEAR
  if (y === 14) return rgba(0, 0, 0, 45)
  if (x === 3 || x === 12 || y === 5 || y === 13) return rgba(62, 40, 22)
  let c = rgba(146, 102, 56)
  if (x < 7) c = add(c, 12)
  if (x === 8 || y === 9) c = add(c, -18)
  return c
}

function well(x, y) {
  if (y > 13) return rgba(0, 0, 0, 50)
  const dx = x - 8
  const dy = y - 9
  if (dx * dx * 0.7 + dy * dy > 28) return CLEAR
  if (dx * dx * 0.5 + (dy + 1) * (dy + 1) < 8) return rgba(36, 78, 110)
  if (Math.abs(dx) > 4 || y < 5) return rgba(150, 146, 136)
  return y < 8 ? rgba(176, 170, 156) : rgba(110, 104, 96)
}

function lamp(x, y) {
  if (x >= 7 && x <= 9 && y > 4 && y < 15) return x === 7 ? rgba(150, 140, 120) : rgba(70, 64, 58)
  if (y > 13 && x > 5 && x < 11) return rgba(0, 0, 0, 40)
  if (y < 6 && x > 4 && x < 12 && y > 1) {
    if (x === 5 || x === 11 || y === 2) return rgba(48, 36, 24)
    return rgba(232, 196, 96)
  }
  return CLEAR
}

function fence(dir, x, y) {
  const post = (px) => x >= px && x <= px + 2 && y >= 2 && y <= 14
  const wood = rgba(124, 84, 46)
  const hi = rgba(156, 112, 64)
  if (dir === 'E' && (post(11) || ((y === 5 || y === 9) && x >= 0))) return post(11) ? hi : wood
  if (dir === 'W' && (post(2) || ((y === 5 || y === 9) && x < 14))) return post(2) ? hi : wood
  if (dir === 'N' && y >= 3 && y <= 7 && (x % 5 === 0 || y === 4 || y === 5)) return x % 5 === 0 ? rgba(86, 56, 30) : wood
  if (dir === 'S' && y >= 8 && y <= 12 && (x % 5 === 0 || y === 9 || y === 10)) return x % 5 === 0 ? rgba(86, 56, 30) : wood
  if (dir === 'P' && x >= 6 && x <= 9 && y >= 2 && y <= 14) return x < 8 ? hi : rgba(78, 52, 28)
  return CLEAR
}

function milestone(x, y) {
  if (y > 13 && x > 3 && x < 13) return rgba(0, 0, 0, 60)
  if (x < 5 || x > 10 || y < 1 || y > 14) return CLEAR
  if (y > 11) return x < 8 ? rgba(160, 154, 142) : rgba(96, 90, 82)
  let c = rgba(142, 136, 126)
  if (x < 7) c = add(c, 18)
  if (x > 8) c = add(c, -20)
  if (y > 4 && y < 10 && x > 5 && x < 10 && (y % 2 === 0) && x % 2 === 0) c = rgba(64, 58, 48)
  if (y === 3) c = rgba(120, 110, 90)
  return c
}

function flower(x, y, kind) {
  const dx = x - 8
  const dy = y - 9
  if (dx * dx + dy * dy > 12) return CLEAR
  if (y > 10 && x === 8) return rgba(36, 100, 36)
  if (dx === 0 && dy === 0) return kind === 1 ? rgba(236, 206, 72) : rgba(244, 240, 230)
  const petals = [rgba(230, 86, 96), rgba(236, 206, 72), rgba(186, 96, 176), rgba(240, 240, 236)]
  return petals[kind % 4]
}

function mushroom(x, y, glow) {
  if (y > 11 && x > 6 && x < 10) return rgba(220, 210, 186)
  if (y === 14) return rgba(0, 0, 0, 35)
  const dx = x - 8
  const dy = y - 8
  if (y >= 6 && y <= 11 && dx * dx + dy * dy <= 16) {
    if (glow && (x + y) % 2 === 0) return rgba(120, 220, 150)
    return dx < 0 && dy < 0 ? rgba(206, 70, 52) : rgba(140, 36, 32)
  }
  return CLEAR
}

function satchel(x, y) {
  if (y === 14 && x > 4 && x < 12) return rgba(0, 0, 0, 40)
  if (x < 4 || x > 12 || y < 4 || y > 13) return CLEAR
  if (y < 8 && x > 5 && x < 11) return rgba(92, 58, 34)
  let c = rgba(138, 88, 48)
  if (x < 7) c = add(c, 16)
  if (x > 10 || y > 11) c = add(c, -14)
  if (y === 9 && x > 6 && x < 10) return rgba(64, 42, 26)
  if (x === 8 && y === 6) return rgba(180, 48, 36)
  return c
}

function herb(x, y) {
  if ((x === 8 || x === 7 || x === 9) && y > 5 && y < 15) return rgba(36, 112, 40)
  if (y > 2 && y < 8 && Math.abs(x - 8) < 4 && (x + y) % 2 === 0) return rgba(72, 160, 58)
  if (y === 3 && (x === 6 || x === 10)) return rgba(220, 180, 70)
  return CLEAR
}

function cache(x, y) {
  if (y === 14) return rgba(0, 0, 0, 40)
  if (x < 3 || x > 12 || y < 6 || y > 13) return CLEAR
  if (y === 6 || x === 3 || x === 12 || y === 13) return rgba(52, 36, 22)
  let c = x < 8 ? rgba(150, 104, 58) : rgba(104, 70, 38)
  if (y === 9) c = rgba(176, 148, 72)
  return c
}

function offering(x, y) {
  const dx = Math.abs(x - 8)
  const dy = Math.abs(y - 9)
  if (dx + dy > 5) return CLEAR
  if (dx + dy > 4) return rgba(40, 90, 50)
  if (x < 8 && y < 9) return rgba(170, 240, 176)
  return rgba(36, 150, 84)
}

function sign(x, y) {
  if (y > 13 && x > 5 && x < 11) return rgba(0, 0, 0, 40)
  if (x >= 7 && x <= 9 && y >= 6 && y <= 14) return x === 7 ? rgba(150, 104, 56) : rgba(78, 50, 28)
  if (y >= 2 && y <= 7 && x >= 2 && x <= 13) {
    if (y === 2 || y === 7 || x === 2 || x === 13) return rgba(62, 40, 22)
    if (y === 4 && x > 4 && x < 11 && x % 2 === 0) return rgba(40, 28, 18)
    return y < 5 ? rgba(176, 148, 96) : rgba(120, 90, 56)
  }
  return CLEAR
}

function board(x, y) {
  if (y === 14) return rgba(0, 0, 0, 35)
  if (x < 2 || x > 13 || y < 3 || y > 13) return CLEAR
  if (x < 3 || y < 4 || x > 12 || y > 12) return rgba(64, 42, 24)
  if (y % 3 === 0 && x > 4 && x < 12) return rgba(92, 70, 46)
  return x < 8 ? rgba(168, 142, 98) : rgba(140, 116, 80)
}

function maskOn(bits, x, y) {
  const nw = bits & 1
  const ne = (bits >> 1) & 1
  const sw = (bits >> 2) & 1
  const se = (bits >> 3) & 1
  const u = x / 15
  const v = y / 15
  const top = nw + (ne - nw) * u
  const bot = sw + (se - sw) * u
  return top + (bot - top) * v >= 0.5
}

function familyPaint(name, x, y) {
  if (name === 'grass') return grass(x, y, 0)
  if (name === 'plains') return plains(x, y, 0)
  if (name === 'forest') return forest(x, y, 0)
  if (name === 'road') return road(x, y)
  if (name === 'water') return water(x, y, 0)
  return cobble(x, y, 0)
}

function dual(pair, bits, x, y) {
  const [fgName, bgName] = pair.split('_')
  const on = maskOn(bits, x, y)
  const fg = familyPaint(fgName, x, y)
  const bg = familyPaint(bgName, x, y)
  const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || ny < 0 || nx > 15 || ny > 15) return false
    return maskOn(bits, nx, ny) !== on
  })
  if (fgName === 'water' && !on) {
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1]].some(([dx, dy]) => {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx > 15 || ny > 15) return false
      return maskOn(bits, nx, ny)
    })
    if (near) return mix(bg, rgba(168, 156, 110), 0.55)
  }
  if (fgName === 'water' && on && edge) return rgba(210, 230, 220)
  if (fgName === 'road' && !on && edge) return mix(bg, rgba(96, 78, 48), 0.4)
  if (on && edge) return add(fg, -28)
  return on ? fg : bg
}

export function paintTile(index, x, y) {
  for (const [pair, row] of Object.entries(DUAL_ROWS)) {
    const start = row * SHEET_COLS
    if (index >= start && index < start + 16) return dual(pair, index - start, x, y)
  }
  switch (index) {
    case T.grass: return grass(x, y, 0)
    case T.grassB: return grass(x, y, 1)
    case T.grassC: return grass(x, y, 2)
    case T.grassD: return grass(x, y, 3)
    case T.plains: return plains(x, y, 0)
    case T.plainsB: return plains(x, y, 1)
    case T.plainsC: return plains(x, y, 2)
    case T.forest: return forest(x, y, 0)
    case T.forestB: return forest(x, y, 1)
    case T.forestC: return forest(x, y, 2)
    case T.water: return water(x, y, 0)
    case T.road: return road(x, y)
    case T.cobble: return cobble(x, y, 0)
    case T.cobbleB: return cobble(x, y, 1)
    case T.cobbleC: return cobble(x, y, 2)
    case T.ford:
    case T.fordB: return ford(x, y)
    case T.wall: return wall(x, y, 0)
    case T.wallB: return wall(x, y, 1)
    case T.wallC: return wall(x, y, 2)
    case T.wallD: return wall(x, y, 3)
    case T.gateL: return gate('L', x, y)
    case T.gateR: return gate('R', x, y)
    case T.bridgeH:
    case T.bridgeHb:
    case T.bridgeV:
    case T.bridgeVb: return bridge(x, y)
    case T.thicket:
    case T.thicketB: return thicket(x, y)
    case T.roof: return roof(x, y, false)
    case T.roofB: return roof(x, y, true)
    case T.roofC: return roof(x, y, false)
    case T.bwall: return bwall(x, y, false)
    case T.bwallB: return bwall(x, y, true)
    case T.bwallC: return bwall(x, y, false)
    case T.door: return bwall(x, y, true)
    case T.doorB: return crate(x, y)
    case T.canopy0: return canopy(0, x, y)
    case T.canopy1: return canopy(1, x, y)
    case T.canopy2: return canopy(2, x, y)
    case T.canopy3: return canopy(3, x, y)
    case T.trunk0: return trunk(0, x, y)
    case T.trunk1: return trunk(1, x, y)
    case T.trunk2: return trunk(2, x, y)
    case T.trunk3: return trunk(3, x, y)
    case T.bush:
    case T.bushB:
    case T.bushC:
    case T.bushD: return bush(x, y, index)
    case T.rock:
    case T.rockB:
    case T.rockC:
    case T.rockD: return rock(x, y, index & 3)
    case T.log: return logPix(x, y)
    case T.logB: return barrel(x, y)
    case T.logC: return cart(x, y)
    case T.flower: return flower(x, y, 0)
    case T.flowerB: return flower(x, y, 1)
    case T.flowerC: return flower(x, y, 2)
    case T.flowerD: return flower(x, y, 3)
    case T.mushroom:
    case T.mushroomB: return mushroom(x, y, false)
    case T.fungi: return mushroom(x, y, true)
    case T.fungiB: return campfire(x, y)
    case T.fenceN: return fence('N', x, y)
    case T.fenceS: return fence('S', x, y)
    case T.fenceE: return fence('E', x, y)
    case T.fenceW: return fence('W', x, y)
    case T.fencePost: return fence('P', x, y)
    case T.fenceCorner: return hay(x, y)
    case T.milestone: return milestone(x, y)
    case T.milestoneB: return well(x, y)
    case T.satchel: return satchel(x, y)
    case T.herb: return herb(x, y)
    case T.cache: return cache(x, y)
    case T.offering: return offering(x, y)
    case T.sign: return sign(x, y)
    case T.board: return board(x, y)
    case T.pebble: return rock(x, y, 1)
    case T.reed: return lamp(x, y)
    default: return rgba(255, 0, 255)
  }
}

export function paintBandit(x, y) {
  if (y > 20 && x > 4 && x < 12) return rgba(0, 0, 0, 50)
  if (y < 6 && x > 4 && x < 12) {
    if (x === 5 || x === 11 || y === 1) return rgba(28, 22, 18)
    return x < 8 ? rgba(72, 48, 36) : rgba(42, 28, 22)
  }
  if (y >= 6 && y < 10 && x > 5 && x < 11) {
    if (x === 6 || x === 10) return rgba(36, 24, 18)
    return rgba(210, 170, 130)
  }
  if (y >= 10 && y < 18 && x > 4 && x < 12) {
    let c = rgba(88, 36, 32)
    if (x < 8) c = add(c, 14)
    if (y === 12) c = rgba(48, 32, 24)
    return c
  }
  if (y >= 18 && y <= 22 && (x === 6 || x === 9)) return rgba(42, 32, 26)
  return CLEAR
}
