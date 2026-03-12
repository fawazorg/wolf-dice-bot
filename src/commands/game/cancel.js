/**
 * @fileoverview Cancel command handler.
 * Handles the `!dice cancel` command to terminate an active game.
 * Channel owners and bot admins can cancel games.
 * @module commands/game/cancel
 */

import { isAuthorizedAdmin } from "../../utils/authorization.js";
import { setLastActive } from "../../storage/mongo/helpers/channel.js";

/**
 * Handle the cancel dice game command.
 * Cancels the active game in the current channel if the requesting user has permission.
 * Authorization is granted to channel owners only.
 * Also updates the channel's last active timestamp for inactivity tracking.
 * @param {import('wolf.js').WOLF} client - WOLF client instance
 * @param {import('wolf.js').CommandContext} command - Command context with request details
 * @param {import('../../managers/GameManager.js').default} game - GameManager instance for game operations
 * @returns {Promise<void>}
 */
export default async (client, command, game) => {
  const channelId = command.targetChannelId;
  const userId = command.sourceSubscriberId;

  await setLastActive(channelId);

  // Check if game exists first
  if (!(await game.hasGame(channelId))) {
    const phrase = client.phrase.getByCommandAndName(command, "dice_game_not_exist");
    return command.reply(phrase);
  }

  // Check permissions: channel owner or bot admin
  const channel = await client.channel.getById(channelId);
  const isChannelOwner = channel.owner.id === userId;
  const isBotAdmin = isAuthorizedAdmin(client, userId);

  if (!isChannelOwner && !isBotAdmin) {
    const phrase = client.phrase.getByCommandAndName(command, "dice_owner_only_command");
    return command.reply(phrase);
  }

  await game.remove(command);
};
