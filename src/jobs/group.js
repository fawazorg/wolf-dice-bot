/**
 * @fileoverview Game timer job factory.
 * Creates timer handlers for managing game phase timeouts.
 * @module jobs/group
 */

/**
 * Factory function to create the UpdateTimer handler.
 * The UpdateTimer is registered with WOLF's timer system to handle join phase timeouts.
 * @param {import('../src/managers/GameManager.js').default} gameManager - Game manager instance
 * @returns {Function} Timer handler function for join phase expiration
 */
export function createUpdateTimer(gameManager) {
  /**
   * Timer callback for join period expiration
   * @param {Object} params
   * @param {number} params.channelId - Channel ID
   */
  return async function UpdateTimer({ channelId }) {
    await gameManager.onJoinTimeout(channelId);
  };
}
