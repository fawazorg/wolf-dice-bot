/**
 * @fileoverview Join command handler.
 * Handles the `!dice join` command to allow players to join an active game.
 * Players can only join during the JOINING phase of the game.
 * @module commands/game/join
 */

/**
 * Handle the join dice game command.
 * Adds the requesting player to the current active game in the channel.
 * Validates that the game is in the JOINING phase before allowing entry.
 * @param {import('wolf.js').CommandContext} command - Command context with request details
 * @param {import('../../managers/GameManager.js').default} game - GameManager instance for game operations
 * @returns {Promise<void>}
 */
export default async (command, game) => {
  await game.join(command);
};
