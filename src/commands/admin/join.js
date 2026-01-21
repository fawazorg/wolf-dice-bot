/**
 * @fileoverview Admin join command handler.
 * Handles the `!dice admin join <groupId>` command to make the bot join a specific group.
 * Validates the group isn't already managed by another bot instance and logs the action.
 * @module commands/admin/join
 */

import { Validator } from 'wolf.js';
import Group from '../../database/models/group.js';
import { isAuthorizedAdmin } from '../../utils/authorization.js';
import { getAdminGroupId } from '../../utils/config.js';

/**
 * Handle the admin join command.
 * Makes the bot join a specified group by ID after validation checks:
 * - Verifies the requesting user has admin or developer privileges
 * - Validates the provided group ID is a valid number
 * - Checks the group isn't already managed by another bot instance in the database
 * - Logs successful joins to the admin notification group
 * @param {import('wolf.js').WOLF} client - WOLF client instance
 * @param {import('wolf.js').CommandContext} command - Command context with group ID as argument
 * @returns {Promise<Response<MessageResponse>>} Response with join result or error message
 */
export default async (client, command) => {
  if (
    !isAuthorizedAdmin(client, command.sourceSubscriberId) ||
    !Validator.isValidNumber(command.argument)
  ) {
    return Promise.resolve();
  }

  const phrase = client.phrase.getByCommandAndName(command, 'dice_message_admin_join');
  // group exist in db by anther bot
  const channleData = await Group.findOne({ gid: parseInt(command.argument) });

  if (channleData) {
    const err = phrase[8];

    return command.reply(err.msg);
  }

  // join response
  const res = await client.channel.joinById(parseInt(command.argument));
  const text = phrase.find((err) => err.code === res.code && err?.subCode === res.headers?.subCode);

  await command.reply(text.msg);
  // log message
  if (res.code === 200) {
    const logPhrase = client.phrase.getByCommandAndName(command, 'dice_admin_join_log');
    const userAdmin = await client.subscriber.getById(command.sourceSubscriberId);
    const channel = await client.channel.getById(parseInt(command.argument));
    const content = client.utility.string.replace(logPhrase, {
      adminNickname: userAdmin.nickname,
      adminID: userAdmin.id,
      groupName: channel.name,
      groupID: channel.id
    });
    const adminGroupId = getAdminGroupId(client);
    if (adminGroupId) {
      return client.messaging.sendChannelMessage(adminGroupId, content);
    }
  }
};
