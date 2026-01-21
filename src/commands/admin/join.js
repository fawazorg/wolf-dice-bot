/**
 * @fileoverview Admin join command handler.
 * Handles the `!dice admin join <channelId>` command to make the bot join a specific channel.
 * Validates the channel isn't already managed by another bot instance and logs the action.
 * @module commands/admin/join
 */

import { Validator } from "wolf.js";
import Channel from "../../database/models/channel.js";
import { isAuthorizedAdmin } from "../../utils/authorization.js";
import { getAdminChannelId } from "../../utils/config.js";

/**
 * Handle the admin join command.
 * Makes the bot join a specified channel by ID after validation checks:
 * - Verifies the requesting user has admin or developer privileges
 * - Validates the provided channel ID is a valid number
 * - Checks the channel isn't already managed by another bot instance in the database
 * - Logs successful joins to the admin notification channel
 * @param {import('wolf.js').WOLF} client - WOLF client instance
 * @param {import('wolf.js').CommandContext} command - Command context with channel ID as argument
 * @returns {Promise<Response<MessageResponse>>} Response with join result or error message
 */
export default async (client, command) => {
  if (
    !isAuthorizedAdmin(client, command.sourceSubscriberId) ||
    !Validator.isValidNumber(command.argument)
  ) {
    return Promise.resolve();
  }

  const phrase = client.phrase.getByCommandAndName(command, "dice_message_admin_join");
  // channel exist in db by anther bot
  const channelData = await Channel.findOne({ channelId: parseInt(command.argument) });

  if (channelData) {
    const err = phrase[8];

    return command.reply(err.msg);
  }

  // join response
  const res = await client.channel.joinById(parseInt(command.argument));
  const text = phrase.find((err) => err.code === res.code && err?.subCode === res.headers?.subCode);

  await command.reply(text.msg);
  // log message
  if (res.code === 200) {
    const logPhrase = client.phrase.getByCommandAndName(command, "dice_admin_join_log");
    const userAdmin = await client.subscriber.getById(command.sourceSubscriberId);
    const channel = await client.channel.getById(parseInt(command.argument));
    const content = client.utility.string.replace(logPhrase, {
      adminNickname: userAdmin.nickname,
      adminID: userAdmin.id,
      channelName: channel.name,
      channelID: channel.id
    });
    const adminChannelId = getAdminChannelId(client);
    if (adminChannelId) {
      return client.messaging.sendChannelMessage(adminChannelId, content);
    }
  }
};
