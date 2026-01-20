/**
 * @fileoverview Admin help command handler.
 * Handles the `!dice admin help` command to display admin-specific commands.
 * Shows comprehensive help information for all available administrative commands.
 * @module commands/admin/help
 */

import { admins } from "../../dice/data.js";

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
  const isDeveloper = command.sourceSubscriberId === client.config.get("developerId");
  const isAdmin = admins.includes(command.sourceSubscriberId);
  const okay = isDeveloper || isAdmin;
  if (!okay) {
    return command.reply(client.phrase.getByCommandAndName(command, ""));
  }
  return command.reply(client.phrase.getByCommandAndName(command, "dice_help_admin_message"));
};
