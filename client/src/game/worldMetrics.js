/**
 * Pixel grid shared by the Phaser scene and the next league-map PR.
 *
 * Painted scenes are a camera window over the native backdrop (1024×1536).
 * The camera uses the smallest integer zoom that covers the browser window,
 * so each world pixel is an integer number of CSS pixels (nearest-neighbor,
 * no letterbox). A larger window shows more of the scene until the next
 * integer step, which tightens the view rather than introducing fractional
 * pixels.
 *
 * The upcoming world map is 16×16 tiles, one league per screen of 20×12.
 * `setPlayfield` on the scene clamps the camera to one screen so a Tiled
 * map can drop in without changing this zoom rule.
 */

export const TILE_SIZE = 32
export const LEAGUE_TILES_X = 20
export const LEAGUE_TILES_Y = 12
export const LEAGUE_SCREEN_W = TILE_SIZE * LEAGUE_TILES_X
export const LEAGUE_SCREEN_H = TILE_SIZE * LEAGUE_TILES_Y

export const PAINTED_WORLD_W = 1024
export const PAINTED_WORLD_H = 1536

/**
 * Standard virtual viewport for 32px Tiled maps (20x11.25 tiles, 640x360).
 * Matches 720p at integer 2x zoom and 1080p at integer 3x zoom.
 */
export const TARGET_VIRTUAL_W = 640
export const TARGET_VIRTUAL_H = 360

/**
 * Wilderness stays a 12×18 layout. Cells are 64px so a 1024×1024 terrain
 * PNG downscales by an exact factor of 16 and lands on the pixel grid.
 */
export const WILDERNESS_CELL = 64
export const WILDERNESS_COLS = 12
export const WILDERNESS_ROWS = 18
export const WILDERNESS_WORLD_W = WILDERNESS_CELL * WILDERNESS_COLS
export const WILDERNESS_WORLD_H = WILDERNESS_CELL * WILDERNESS_ROWS

/**
 * Class speeds (160 / 180 / 200) were canvas pixels per second when the
 * whole painting was contain-fit into a ~900px-tall frame. World units are
 * native pixels, so speeds (and other pixel constants) scale by worldH/900
 * and a knight still crosses a painted scene in the same time.
 */
export const REFERENCE_FRAME_H = 900

export function scaleFromReference(pixels, worldH) {
  return pixels * (worldH / REFERENCE_FRAME_H)
}

/**
 * Smallest integer camera zoom that covers the viewport.
 * Zoom 1 is the floor: if the world is already larger than the window, the
 * camera shows a 1:1 window and pans, with no bars.
 * @param {number} viewW
 * @param {number} viewH
 * @param {number} worldW
 * @param {number} worldH
 * @returns {number}
 */
export function integerCoverZoom(viewW, viewH, worldW, worldH) {
  if (!(viewW > 0 && viewH > 0 && worldW > 0 && worldH > 0)) return 1
  const cover = Math.max(viewW / worldW, viewH / worldH)
  return Math.max(1, Math.ceil(cover - 1e-4))
}

/**
 * Calibrated integer camera zoom for Tiled maps.
 * Decouples Tiled maps from painted-backdrop cover rules, providing a consistent
 * ~640x360 virtual viewport with integer pixel art scaling across resolutions
 * (e.g. 2x at 1280x720, 3x at 1920x1080, 4x at 2560x1440).
 * @param {number} viewW
 * @param {number} viewH
 * @returns {number}
 */
export function integerTiledZoom(viewW, viewH) {
  if (!(viewW > 0 && viewH > 0)) return 1
  const zX = viewW / TARGET_VIRTUAL_W
  const zY = viewH / TARGET_VIRTUAL_H
  return Math.max(1, Math.floor(Math.min(zX, zY) + 1e-4))
}
