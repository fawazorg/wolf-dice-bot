/**
 * @fileoverview Balance command handler.
 * Handles the `!dice balance` command to display the player's current balance.
 * Shows the player's remaining points in the active game.
 * @module commands/balance
 */

/**
 * Handle the balance query command.
 * Displays the requesting player's current balance in the active game.
 * If no game is active or player is not in a game, returns an appropriate message.
 * @param {import('wolf.js').CommandContext} command - Command context with request details
 * @param {import('../src/managers/GameManager.js').default} game - GameManager instance for game operations
 * @returns {Promise<void>}
 */
export default async (command, game) => {
  await game.balance(command);
};
