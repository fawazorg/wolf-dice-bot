/**
 * @fileoverview Cancel command handler.
 * Handles the `!dice cancel` command to terminate an active game.
 * Only game creator or channel owner can cancel games.
 * @module commands/cancel
 */

/**
 * Handle the cancel dice game command.
 * Cancels the active game in the current channel if the requesting user has permission.
 * Authorization is granted to channel owners and the game creator.
 * @param {import('wolf.js').WOLF} client - WOLF client instance
 * @param {import('wolf.js').CommandContext} command - Command context with request details
 * @param {import('../src/managers/GameManager.js').default} game - GameManager instance for game operations
 * @returns {Promise<void>}
 */
export default async (client, command, game) => {
  const channelId = command.targetChannelId;
  const userId = command.sourceSubscriberId;

  // Check if game exists first
  if (!(await game.hasGame(channelId))) {
    const phrase = client.phrase.getByCommandAndName(command, "dice_game_not_exist");
    return command.reply(phrase);
  }

  // Check permissions: channel owner or game creator
  const channel = await client.channel.getById(channelId);
  const isChannelOwner = channel.owner.id === userId;
  const gameCreator = await game.getGameCreator(channelId);
  const isGameCreator = gameCreator === userId;

  if (!isChannelOwner && !isGameCreator) {
    const phrase = client.phrase.getByCommandAndName(command, "dice_owner_only_command");
    return command.reply(phrase);
  }

  await game.remove(command);
};
