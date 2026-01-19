/**
 * Factory function to create the UpdateTimer handler
 * @param {import('../src/managers/GameManager.js').default} gameManager
 * @returns {Function} Timer handler function
 */
export function createUpdateTimer(gameManager) {
  /**
   * Timer callback for join period expiration
   * @param {Object} params
   * @param {number} params.channleId - Channel ID (note: typo preserved for compatibility)
   */
  return async function UpdateTimer({ channleId }) {
    await gameManager.onJoinTimeout(channleId);
  };
}
