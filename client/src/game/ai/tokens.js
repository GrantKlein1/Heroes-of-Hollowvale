/**
 * Attack Token Manager for Enemy Combat Coordination.
 *
 * Limits the number of enemies that can execute attack sequences (telegraph or swing)
 * simultaneously to avoid overwhelming the player.
 *
 * Default capacity: 2 attack tokens.
 */

export class AttackTokenManager {
  /**
   * @param {number} [maxTokens=2] - Maximum concurrent attack tokens available
   */
  constructor(maxTokens = 2) {
    this.maxTokens = maxTokens
    this.tokens = new Set()
  }

  /**
   * Attempts to acquire an attack token for the specified enemy.
   *
   * @param {object} enemy - The enemy requesting an attack token
   * @returns {boolean} - True if token was acquired or already held, false otherwise
   */
  acquire(enemy) {
    if (!enemy) return false
    if (this.tokens.has(enemy)) {
      return true
    }
    if (this.tokens.size < this.maxTokens) {
      this.tokens.add(enemy)
      return true
    }
    return false
  }

  /**
   * Releases the attack token held by the specified enemy.
   *
   * @param {object} enemy - The enemy releasing its token
   * @returns {boolean} - True if a token was released, false if none held
   */
  release(enemy) {
    if (!enemy) return false
    return this.tokens.delete(enemy)
  }

  /**
   * Checks whether the specified enemy currently holds an attack token.
   *
   * @param {object} enemy
   * @returns {boolean}
   */
  has(enemy) {
    if (!enemy) return false
    return this.tokens.has(enemy)
  }

  /**
   * Returns the count of currently allocated attack tokens.
   *
   * @returns {number}
   */
  get count() {
    return this.tokens.size
  }

  /**
   * Clears all allocated tokens.
   */
  clear() {
    this.tokens.clear()
  }
}
