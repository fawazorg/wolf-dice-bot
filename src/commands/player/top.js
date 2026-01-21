/**
 * @fileoverview Top players command handler.
 * Handles the `!dice top` command to display the global leaderboard.
 * Shows the top-ranked players with their scores across all games.
 * @module commands/top
 */

import { getTopPlayers } from "../../database/helpers/player.js";

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
  const topPlayers = await getTopPlayers();

  if (topPlayers.length === 0) {
    return command.reply(
      client.phrase.getByCommandAndName(command, "dice_leaderboard_empty")
    );
  }

  // Fetch all subscriber data in parallel for better performance
  const playersWithSubscribers = await Promise.all(
    topPlayers.map(async (player) => ({
      subscriber: await client.subscriber.getById(player.id),
      score: player.score
    }))
  );

  // Build leaderboard entries with proper formatting
  const leaderboardList = playersWithSubscribers
    .map(({ subscriber, score }, index) =>
      `${index + 1} ـ ${subscriber.nickname} (${subscriber.id}) ـ ${score}`
    )
    .join('\n');

  return command.reply(
    client.utility.string.replace(
      client.phrase.getByCommandAndName(command, "dice_leaderboard_top_players"),
      { list: leaderboardList }
    )
  );
};
