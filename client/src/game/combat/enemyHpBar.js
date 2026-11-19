/** World pixels between the anchor and the top of the health bar. */
export const ENEMY_HP_BAR_GAP = 8

/**
 * World Y of the top edge of an enemy health bar.
 *
 * Foes with no `visibleTopPx` keep the half-height measurement. That is where
 * the goblin, brute, archer and wolf bars already sit, and lifting them to the
 * frame top would hang those bars in the transparent margin.
 *
 * Ashen cultist and revenant pass `visibleTopPx`, the first opaque row in the
 * 96px cell. Half the frame is not that row: it lands the bar across the hood
 * and the flame crown. The bar is placed GAP pixels above the visible pixels.
 *
 * @param {{ y?: number, originY?: number, displayHeight?: number, frameHeight?: number, visibleTopPx?: number }} enemy
 * @returns {number}
 */
export function enemyHpBarTop(enemy) {
  const y = Number(enemy?.y) || 0
  const height = Number(enemy?.displayHeight) || 0
  const visibleTop = enemy?.visibleTopPx
  if (typeof visibleTop === 'number' && Number.isFinite(visibleTop) && height > 0) {
    const originY = typeof enemy.originY === 'number' ? enemy.originY : 0.5
    const frameH = Number(enemy.frameHeight) > 0 ? Number(enemy.frameHeight) : height
    const frameTop = y - originY * height
    return frameTop + visibleTop * (height / frameH) - ENEMY_HP_BAR_GAP
  }
  return y - height / 2 - ENEMY_HP_BAR_GAP
}
