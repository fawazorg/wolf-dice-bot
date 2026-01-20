/**
 * @fileoverview Rank command handler.
 * Handles the `!dice rank` command to display player's global ranking.
 * Shows the player's current rank and total score across all games.
 * @module commands/rank
 */

import { getPlayerRankData } from "../database/helpers/player.js";

/**
 * Handle the rank query command.
 * Retrieves and displays the requesting player's global rank and total score.
 * If the player has no recorded scores, displays a no-score message.
 * @param {import('wolf.js').WOLF} client - WOLF client instance
 * @param {import('wolf.js').CommandContext} command - Command context with request details
 * @returns {Promise<Response<MessageResponse>>} Response with rank and score information
 */
export default async (client, command) => {
  const data = await getPlayerRankData(command.sourceSubscriberId);
  const user = await client.subscriber.getById(command.sourceSubscriberId);

  if (!data) {
    return command.reply(
      client.utility.string.replace(
        client.phrase.getByCommandAndName(command, "dice_message_no_score"),
        {
          nickname: user.nickname,
          id: user.id
        }
      )
    );
  }
  return command.reply(
    client.utility.string.replace(
      client.phrase.getByCommandAndName(command, "dice_message_score"),
      {
        rank: data.GlobalRank,
        total: data.score,
        nickname: user.nickname,
        id: user.id
      }
    )
  );
};
