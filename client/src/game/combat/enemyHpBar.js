/** World pixels between the opaque pixels and the top of the health bar. */
export const ENEMY_HP_BAR_GAP = 8

/**
 * Source-cell row the health bar has to clear.
 *
 * A def's `visibleTopPx` is the highest opaque pixel of idle/walk/attack/hurt,
 * so one still bar stays above every living frame. Sheets without that
 * measurement (the red dragon) are trimmed: each pose's packed box starts on
 * its own first opaque row, and the bar uses that row. Anything else uses the
 * cell top, which is above every pixel in the cell.
 *
 * @param {{ visibleTopPx?: number, trimmedTopPx?: number }} enemy
 * @returns {number}
 */
export function resolveVisibleTopPx(enemy) {
  const stored = enemy?.visibleTopPx
  if (typeof stored === 'number' && Number.isFinite(stored)) return stored
  const trim = enemy?.trimmedTopPx
  if (typeof trim === 'number' && Number.isFinite(trim)) return trim
  return 0
}

/**
 * First opaque source-cell row of a trimmed atlas frame.
 * Untrimmed frames return undefined so a stored measurement is what places the bar.
 *
 * @param {{ customData?: { trimmed?: boolean, spriteSourceSize?: { y?: number } } }} [frame]
 * @returns {number|undefined}
 */
export function trimmedTopPxFromFrame(frame) {
  const data = frame?.customData
  if (!data || data.trimmed !== true) return undefined
  const y = data.spriteSourceSize?.y
  return typeof y === 'number' && Number.isFinite(y) ? y : undefined
}

/**
 * World Y of the top edge of an enemy health bar.
 *
 * The bar sits GAP pixels above the first opaque row. `frameTop` is the top
 * of the source cell: Phaser sizes the sprite to sourceSize and the atlas
 * origin is a fraction of that cell, for both untrimmed enemy cells and the
 * dragon's trimmed frames.
 *
 * @param {{ y?: number, originY?: number, displayHeight?: number, frameHeight?: number, visibleTopPx?: number, trimmedTopPx?: number }} enemy
 * @returns {number}
 */
export function enemyHpBarTop(enemy) {
  const y = Number(enemy?.y) || 0
  const height = Number(enemy?.displayHeight) || 0
  if (!(height > 0)) return y - ENEMY_HP_BAR_GAP
  const originY = typeof enemy?.originY === 'number' ? enemy.originY : 0.5
  const frameH = Number(enemy?.frameHeight) > 0 ? Number(enemy.frameHeight) : height
  const frameTop = y - originY * height
  return frameTop + resolveVisibleTopPx(enemy) * (height / frameH) - ENEMY_HP_BAR_GAP
}

/**
 * World Y of the HP number's baseline.
 *
 * The number is drawn with origin (0.5, 1), so it sits on top of the bar and
 * above the sprite. When the camera would clip it, it drops toward the bar,
 * and no further than one pixel above the opaque pixels.
 *
 * @param {number} barTop
 * @param {number} textHeight
 * @param {number} [viewTop]
 * @returns {number}
 */
export function enemyHpTextBottom(barTop, textHeight, viewTop) {
  const preferred = barTop - 1
  const height = Number(textHeight) > 0 ? Number(textHeight) : 0
  if (!(typeof viewTop === 'number' && Number.isFinite(viewTop)) || !(height > 0)) return preferred
  const minBottom = viewTop + height
  if (preferred >= minBottom) return preferred
  const aboveSprite = barTop + ENEMY_HP_BAR_GAP - 1
  return Math.min(aboveSprite, Math.max(preferred, minBottom))
}
