/**
 * @fileoverview Leaderboard command handler.
 * Handles the `!dice top` command to display the global leaderboard.
 * Shows the top-ranked players with their scores across all games.
 * @module commands/leaderboard
 */

import { getTopPlayers } from "../database/helpers/player.js";

/**
 * Handle the top players leaderboard command.
 * Retrieves and displays a ranked list of the top players globally,
 * including their nicknames, IDs, and total scores.
 * If no players have scores, displays a no-score message.
 * @param {import('wolf.js').WOLF} client - WOLF client instance
 * @param {import('wolf.js').CommandContext} command - Command context with request details
 * @returns {Promise<Response<MessageResponse>>} Response with leaderboard or no-score message
 */
export default async (client, command) => {
  const data = await getTopPlayers();
  if (data.length > 0) {
    let r = "";
    for (let index = 0; index < data.length; index++) {
      const user = data[index];
      const sub = await client.subscriber.getById(user.id);
      if (index === data.length - 1) {
        r += `${index + 1} ـ ${(client, sub.nickname)} ( ${sub.id} ) ـ  ${user.score}`;
      } else {
        r += `${index + 1} ـ ${(client, sub.nickname)} ( ${sub.id} ) ـ  ${user.score}\n`;
      }
    }
    return command.reply(
      client.utility.string.replace(
        client.phrase.getByCommandAndName(command, "dice_leaderboard_top_players"),
        {
          list: r
        }
      )
    );
  }
  return command.reply(client.phrase.getByCommandAndName(command, "dice_leaderboard_empty"));
};
