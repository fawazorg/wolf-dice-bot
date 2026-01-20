/**
 * @fileoverview Admin help command handler.
 * Handles the `!dice admin help` command to display admin-specific commands.
 * Shows comprehensive help information for all available administrative commands.
 * @module commands/admin/help
 */

import { isAuthorizedAdmin } from "../../utils/authorization.js";

/**
 * Handle the admin help command.
 * Displays detailed help information for all admin commands including:
 * - count: View total active channels
 * - join: Make bot join a specific group
 * - refresh: Refresh game state for all channels
 * - update: Update bot status message
 * Access is restricted to the configured developer ID and authorized admin user IDs.
 * @param {import('wolf.js').WOLF} client - WOLF client instance
 * @param {import('wolf.js').CommandContext} command - Command context with request details
 * @returns {Promise<Response<MessageResponse>>} Response with admin help message or unauthorized message
 */
export default async (client, command) => {
  if (!isAuthorizedAdmin(client, command.sourceSubscriberId)) {
    return command.reply(
      client.phrase.getByCommandAndName(command, "dice_admin_not_authorized_message")
    );
  }
  return command.reply(client.phrase.getByCommandAndName(command, "dice_help_admin_message"));
};
