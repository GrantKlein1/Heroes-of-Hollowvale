/**
 * Hand-authored landmark interiors. Null means "use the generated kind".
 * The outer ring of each league is never stamped, so shared edges stay
 * on the world function. Baked Tiled JSON is written by generateTileset.mjs.
 */

import { LEAGUE_H, LEAGUE_MAX_X, LEAGUE_MAX_Y, LEAGUE_MIN_X, LEAGUE_MIN_Y, LEAGUE_W, STRIDE_X, STRIDE_Y } from './metrics.js'
import { RUINWATCH, isRoad } from './roads.js'

function brackenford(wx, wy) {
  if (wy < 1 || wy > 10 || wx < 1 || wx > 18) return null
  if (wy === 10 && (wx === 9 || wx === 10)) return 'gate'
  if (isRoad(wx, wy)) return null
  if (wy === 7) return null
  if (wy === 1 && wx >= 2 && wx <= 17) return 'wall'
  if (wy === 10 && wx >= 2 && wx <= 17) {
    if (wx === 9 || wx === 10) return 'gate'
    return 'wall'
  }
  if (wx === 1 && wy >= 2 && wy <= 9) return 'wall'
  if (wx === 18 && wy >= 2 && wy <= 9) return 'wall'
  if (wx >= 8 && wx <= 11 && wy === 2) return 'roof'
  if (wx >= 8 && wx <= 11 && wy === 3) return 'bwall'
  if (wx >= 2 && wx <= 4 && wy === 3) return 'roof'
  if (wx >= 2 && wx <= 4 && (wy === 4 || wy === 5)) return 'bwall'
  if (wx >= 13 && wx <= 15 && wy === 3) return 'roof'
  if (wx >= 13 && wx <= 15 && wy === 4) return 'bwall'
  if (wy >= 4 && wy <= 6 && wx >= 5 && wx <= 16) return 'cobble'
  if (wy >= 8 && wy <= 9 && wx >= 8 && wx <= 11) return 'cobble'
  return null
}

function hearthmile(wx, wy) {
  if (isRoad(wx, wy)) return null
  const pad = (
    (wx >= 6 && wx <= 8 && wy >= 48 && wy <= 50)
  )
  if (pad) return 'cobble'
  return null
}

function ruinwatch(wx, wy) {
  if (isRoad(wx, wy)) return null
  const dx = Math.abs(wx - RUINWATCH.wx)
  const dy = Math.abs(wy - RUINWATCH.wy)
  if (dx <= 2 && dy <= 1) return 'cobble'
  return null
}

export function stampKind(wx, wy) {
  if (wy >= 0 && wy <= 11 && wx >= 0 && wx <= 19) return brackenford(wx, wy)
  if (wy >= 44 && wy <= 55 && wx >= 0 && wx <= 19) return hearthmile(wx, wy)
  if (Math.abs(wx - RUINWATCH.wx) <= 3 && Math.abs(wy - RUINWATCH.wy) <= 3) return ruinwatch(wx, wy)
  return null
}

function leagueContaining(wx, wy) {
  for (let ly = LEAGUE_MIN_Y; ly <= LEAGUE_MAX_Y; ly++) {
    for (let lx = LEAGUE_MIN_X; lx <= LEAGUE_MAX_X; lx++) {
      const x0 = lx * STRIDE_X
      const y0 = ly * STRIDE_Y
      if (wx >= x0 && wx < x0 + LEAGUE_W && wy >= y0 && wy < y0 + LEAGUE_H) return { lx, ly }
    }
  }
  return { lx: 0, ly: 0 }
}

const campLeague = leagueContaining(RUINWATCH.wx, RUINWATCH.wy)

export const STAMP_LEAGUES = [
  { lx: 0, ly: 0, key: 'brackenford', name: 'Brackenford' },
  { lx: 0, ly: 4, key: 'hearthmile', name: 'Hearthmile Stone' },
  { lx: campLeague.lx, ly: campLeague.ly, key: 'ruinwatch', name: 'Ruinwatch' },
]
