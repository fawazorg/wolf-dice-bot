/**
 * @fileoverview Admin status command handler.
 * Handles the `!dice admin status` command to check channel inactivity status.
 * @module commands/admin/status
 */

import { getChannelInactivity } from "../../storage/mongo/helpers/channel.js";

/**
 * Handle the admin status command.
 * Displays inactivity information for the current channel including:
 * - Last active timestamp
 * - Days since last activity
 * - Whether the channel would be marked for cleanup
 * @param {import('wolf.js').WOLF} client - WOLF client instance
 * @param {import('wolf.js').CommandContext} command - Command context with request details
 * @returns {Promise<Response<MessageResponse>>} Response with channel status information
 */
export default async (client, command) => {
  const channelId = command.targetChannelId;

  const inactivityData = await getChannelInactivity(channelId);

  if (!inactivityData) {
    return command.reply(
      client.utility.string.replace(
        client.phrase.getByCommandAndName(command, "dice_admin_channel_not_tracked"),
        {
          channelId
        }
      )
    );
  }

  const { lastActiveAt, days } = inactivityData;
  const daysAgo = Math.floor(days * 10) / 10; // Round to 1 decimal place
  const willLeave = days > 5 ? "🔴 Will be marked for cleanup" : "🟢 Active";

  return command.reply(
    client.utility.string.replace(
      client.phrase.getByCommandAndName(command, "dice_admin_channel_status"),
      {
        channelId,
        lastActive: lastActiveAt.toISOString().split("T")[0],
        daysAgo,
        status: willLeave
      }
    )
  );
};
