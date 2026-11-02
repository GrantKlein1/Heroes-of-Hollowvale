/**
 * Ember Road geometry in world tiles.
 * Due south from Brackenford's south gate (wy 10) to the Hearthmile bend,
 * then west-northwest. The bend is 4-connected so a flood of road tiles
 * reaches the stone.
 */

const BEND = new Set([
  '9,48', '8,48', '7,48', '6,48', '5,48', '4,48', '3,48',
  '10,48', '5,47', '4,47',
  '3,47', '2,47', '1,47', '0,47',
  '2,48', '1,48', '0,48',
  '-1,47', '-1,46', '-2,46', '-3,46', '-4,46',
  '-2,47', '-3,47', '-4,47',
])

/**
 * Sixteen leagues west-northwest from the Hearthmile bend, along the
 * northern eaves, to Ruinwatch. One league of road is about 18 tiles,
 * the length of a screen along the stride. Every fifth step also steps
 * north so the bearing stays west of northwest.
 */
function edge(n, m) {
  return ((n % m) + m) % m === 0
}

function buildEavesRoad() {
  const cells = new Set()
  const center = []
  const add = (x, y) => {
    cells.add(`${x},${y}`)
    cells.add(`${x},${y + 1}`)
  }
  let x = -4
  let y = 46
  const steps = 16 * 18
  for (let i = 0; i <= steps; i++) {
    add(x, y)
    center.push({ wx: x, wy: y, i })
    x -= 1
    add(x, y)
    if (i % 5 === 4) {
      y -= 1
      add(x, y)
    }
  }
  let guard = 0
  while ((edge(x, 19) || edge(y, 11)) && guard < 8) {
    x -= 1
    add(x, y)
    center.push({ wx: x, wy: y, i: steps + 1 + guard })
    guard += 1
  }
  return { cells, center }
}

const EAVES = buildEavesRoad()

export const EAVES_CENTER = EAVES.center
export const RUINWATCH_ROAD = EAVES.center[EAVES.center.length - 1]

function beside(p) {
  let x = p.wx
  let y = p.wy
  if (edge(y, 11)) y += 1
  if (edge(x, 19)) x += 1
  return { wx: x, wy: y, i: p.i }
}

/** Camp sits just off the shared screen edge, beside the end of the road. */
export const RUINWATCH = beside(RUINWATCH_ROAD)

/** A mark beside the road every four leagues. The last one is the camp. */
export const EAVES_MARKS = EAVES.center
  .filter((p) => p.i > 0 && p.i % 72 === 0 && p.i < 288)
  .map(beside)

export function isRoad(wx, wy) {
  // Three-tile cart road south of the gate. The gate itself stays two tiles.
  if ((wx === 8 || wx === 9 || wx === 10) && wy >= 11 && wy <= 47) return true
  if (BEND.has(`${wx},${wy}`)) return true
  return EAVES.cells.has(`${wx},${wy}`)
}

/** Horizontal Bracken, wy 7. Ford at the town, a plank bridge just west of it. */
export function riverKind(wx, wy) {
  if (wy !== 7) return null
  if (wx < -28 || wx > 48) return null
  if (wx >= 8 && wx <= 11) return 'ford'
  if (wx === 5 || wx === 6) return 'bridge'
  return 'water'
}
