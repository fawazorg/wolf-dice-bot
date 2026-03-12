/**
 * @fileoverview Create command handler.
 * Handles the `!dice create [balance]` command to start a new dice game in a channel.
 * Players can optionally specify a starting balance for the game.
 * @module commands/game/create
 */

import { setLastActive } from "../../storage/mongo/helpers/channel.js";

/**
 * Handle the create dice game command.
 * Creates a new dice game in the current channel with optional custom starting balance.
 * If no balance is specified, uses the default balance from configuration.
 * Also updates the channel's last active timestamp for inactivity tracking.
 * @param {import('wolf.js').CommandContext} command - Command context with request details
 * @param {import('../../managers/GameManager.js').default} game - GameManager instance for game operations
 * @returns {Promise<void>}
 */
export default async (command, game) => {
  await setLastActive(command.targetChannelId);
  await game.create(command, command.argument);
};
