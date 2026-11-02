/**
 * Ember Road geometry in world tiles.
 * Due south from Brackenford's south gate (wy 10) to the Hearthmile bend,
 * then west-northwest. The bend is 4-connected so a flood of road tiles
 * reaches the stone.
 */

const BEND = new Set([
  '11,48', '10,48', '9,48', '8,48', '7,48', '6,48', '5,48', '4,48', '3,48',
  '7,47', '6,47', '5,47', '4,47',
  '3,47', '2,47', '1,47', '0,47',
  '5,46', '4,46', '3,46', '2,46', '1,46', '0,46',
  '2,48', '1,48', '0,48',
  '-1,47', '-1,46', '-2,46', '-3,46', '-4,46',
  '-2,47', '-3,47', '-4,47',
])

export function isRoad(wx, wy) {
  // Four tiles wide so the dirt edge fringe reads as about three tiles of track.
  // The gate itself stays two tiles. The bend set covers the turn at Hearthmile.
  if (wx >= 8 && wx <= 11 && wy >= 11 && wy <= 47) return true
  return BEND.has(`${wx},${wy}`)
}

/** Horizontal Bracken, wy 7. Ford at the town, a plank bridge just west of it. */
export function riverKind(wx, wy) {
  if (wy !== 7) return null
  if (wx < -28 || wx > 48) return null
  if (wx >= 8 && wx <= 11) return 'ford'
  if (wx === 5 || wx === 6) return 'bridge'
  return 'water'
}
