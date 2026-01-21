/**
 * @fileoverview Status command handler.
 * Handles the `!dice status` command to display dice roll statistics.
 * Shows comprehensive statistics about a player's dice rolls and game performance.
 * @module commands/status
 */

import Player from "../../database/models/player.js";
import { getByKey, getPercentage } from "../../utils/statistics.js";

/**
 * Handle the status query command.
 * Displays detailed statistics about the requesting player's dice roll history,
 * including total rolls, win rate, and other performance metrics.
 * @param {import('wolf.js').WOLF} client - WOLF client instance
 * @param {import('wolf.js').CommandContext} command - Command context with request details
 * @returns {Promise<Response<MessageResponse>>} Response with player statistics
 */
export default async (client, command) => {
  const player = await Player.findOne({ id: command.sourceSubscriberId });

  if (!player || player.status.length <= 0) {
    const phrase = client.phrase.getByCommandAndName(command, "dice_player_no_statistics");
    return command.reply(phrase);
  }

  const percentage = getPercentage(player.status);
  const phrase = client.phrase.getByCommandAndName(command, "dice_player_statistics");
  const text = client.utility.string.replace(phrase, {
    d1: getByKey(percentage, 1),
    d2: getByKey(percentage, 2),
    d3: getByKey(percentage, 3),
    d4: getByKey(percentage, 4),
    d5: getByKey(percentage, 5),
    d6: getByKey(percentage, 6)
  });

  return command.reply(text);
};
