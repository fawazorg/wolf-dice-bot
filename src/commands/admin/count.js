/**
 * @fileoverview Admin count command handler.
 * Handles the `!dice admin count` command to display the number of active games.
 * Shows the total count of channels where the bot is currently active.
 * @module commands/admin/count
 */

import { admins } from "../../dice/data.js";

/**
 * Handle the admin count command.
 * Retrieves and displays the total number of channels the bot is currently in.
 * This helps administrators monitor bot deployment and usage across the platform.
 * Access is restricted to the configured developer ID and authorized admin user IDs.
 * @param {import('wolf.js').WOLF} client - WOLF client instance
 * @param {import('wolf.js').CommandContext} command - Command context with request details
 * @returns {Promise<Response<MessageResponse>>} Response with channel count or unauthorized message
 */
export default async (client, command) => {
  const isDeveloper = command.sourceSubscriberId === client.config.get("developerId");
  const isAdmin = admins.includes(command.sourceSubscriberId);
  const okay = isDeveloper || isAdmin;
  if (!okay) {
    return command.reply(
      client.phrase.getByCommandAndName(command, "dice_admin_not_authorized_message")
    );
  }
  const count = (await client.channel.list()).length;
  return command.reply(
    client.utility.string.replace(
      client.phrase.getByCommandAndName(command, "dice_admin_count_message"),
      { count }
    )
  );
};
