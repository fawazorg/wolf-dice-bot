/**
 * @fileoverview Status command handler.
 * Handles the `!dice status` command to display dice roll statistics.
 * Shows comprehensive statistics about a player's dice rolls and game performance.
 * @module commands/status
 */

import { status } from "../dice/status.js";

/**
 * Handle the status query command.
 * Displays detailed statistics about the requesting player's dice roll history,
 * including total rolls, win rate, and other performance metrics.
 * @param {import('wolf.js').WOLF} client - WOLF client instance
 * @param {import('wolf.js').CommandContext} command - Command context with request details
 * @returns {Promise<Response<MessageResponse>>} Response with player statistics
 */
export default async (client, command) => {
  return status(client, command);
};
