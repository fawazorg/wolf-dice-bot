/**
 * @fileoverview Default admin command handler.
 * Handles the base `!dice admin` command without subcommands.
 * Requires developer or admin authorization to access.
 * @module commands/admin/main
 */

import { isAuthorizedAdmin } from "../../utils/authorization.js";

/**
 * Handle the default admin command.
 * Displays the default admin help message when authorized users type `!dice admin` without arguments.
 * Access is restricted to the configured developer ID and authorized admin user IDs.
 * @param {import('wolf.js').WOLF} client - WOLF client instance
 * @param {import('wolf.js').CommandContext} command - Command context with request details
 * @returns {Promise<Response<MessageResponse>>} Response with admin default message or unauthorized message
 */
export default async (client, command) => {
  if (!isAuthorizedAdmin(client, command.sourceSubscriberId)) {
    return command.reply(client.phrase.getByCommandAndName(command, "dice_admin_unauthorized"));
  }
  return command.reply(client.phrase.getByCommandAndName(command, "dice_default_admin_message"));
};
