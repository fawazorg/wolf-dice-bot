/**
 * @fileoverview Cancel command handler.
 * Handles the `!dice cancel` command to terminate an active game.
 * Only channel owners or WOLF volunteers can cancel games.
 * @module commands/cancel
 */

import { Privilege } from "wolf.js";

/**
 * Handle the cancel dice game command.
 * Cancels the active game in the current channel if the requesting user has permission.
 * Authorization is granted to channel owners and users with VOLUNTEER privilege.
 * @param {import('wolf.js').WOLF} client - WOLF client instance
 * @param {import('wolf.js').CommandContext} command - Command context with request details
 * @param {import('../src/managers/GameManager.js').default} game - GameManager instance for game operations
 * @returns {Promise<void>}
 */
export default async (client, command, game) => {
  const IsVolunteer = await client.utility.subscriber.privilege.has(
    command.sourceSubscriberId,
    Privilege.VOLUNTEER,
  );
  const Channel = await client.channel.getById(command.targetChannelId);
  const IsChannelOwner = Channel.owner.id === command.sourceSubscriberId;
  const okay = IsVolunteer || IsChannelOwner;
  if (!okay) {
    const phrase = client.phrase.getByCommandAndName(command, "dice_owner_only_command");

    return command.reply(phrase);
  }
  await game.remove(command);
};
