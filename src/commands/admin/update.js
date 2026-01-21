/**
 * @fileoverview Admin update command handler.
 * Handles the `!dice admin update <status>` command to update the bot's status message.
 * Allows administrators to change the bot's displayed status across the platform.
 * @module commands/admin/update
 */

import { isAuthorizedAdmin } from "../../utils/authorization.js";

/**
 * Handle the admin update command.
 * Updates the bot's current status message to the provided text.
 * This status is displayed on the bot's profile and can be used to communicate
 * maintenance notifications, version information, or other important messages.
 * Access is restricted to the configured developer ID and authorized admin user IDs.
 * @param {import('wolf.js').WOLF} client - WOLF client instance
 * @param {import('wolf.js').CommandContext} command - Command context with new status as argument
 * @returns {Promise<Response<MessageResponse>>} Response confirming status update or unauthorized message
 */
export default async (client, command) => {
  if (!isAuthorizedAdmin(client, command.sourceSubscriberId)) {
    return command.reply(client.phrase.getByCommandAndName(command, "dice_admin_unauthorized"));
  }
  const status = command.argument;
  // TODO: Add error handling for failed status updates (network errors, API failures)
  await client.currentSubscriber.update({ status });

  const phrase = client.phrase.getByCommandAndName(command, "dice_admin_status_updated");
  const content = client.utility.string.replace(phrase, { status });

  return command.reply(content);
};
