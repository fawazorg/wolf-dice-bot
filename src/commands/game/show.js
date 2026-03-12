/**
 * @fileoverview Show command handler.
 * Handles the `!dice show` command to display the current game state.
 * Provides information about active players, game phase, and relevant game data.
 * @module commands/game/show
 */

import { setLastActive } from "../../storage/mongo/helpers/channel.js";

/**
 * Handle the show game state command.
 * Displays comprehensive information about the current game including:
 * - Active players and their status
 * - Current game phase (JOINING, GUESSING, PICKING, BETTING, ROLLING)
 * - Phase-specific information (guesses, picks, bets, etc.)
 * Also updates the channel's last active timestamp for inactivity tracking.
 * @param {import('wolf.js').CommandContext} command - Command context with request details
 * @param {import('../../managers/GameManager.js').default} game - GameManager instance for game operations
 * @returns {Promise<void>}
 */
export default async (command, game) => {
  await setLastActive(command.targetChannelId);
  await game.show(command);
};
