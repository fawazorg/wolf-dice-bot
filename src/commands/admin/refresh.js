/**
 * @fileoverview Admin refresh command handler.
 * Handles the `!dice admin refresh` command to refresh game state across all channels.
 * Synchronizes bot state with database and updates any unset group configurations.
 * @module commands/admin/refresh
 */

import { refreshUnsetGroup } from '../../database/helpers/group.js';
import { isAuthorizedAdmin } from '../../utils/authorization.js';

/**
 * Handle the admin refresh command.
 * Refreshes game state across all channels by:
 * - Identifying groups that need configuration updates
 * - Synchronizing database state with active games
 * - Returning a list of refreshed group names
 * This is useful for recovering from errors or updating configurations across all channels.
 * Access is restricted to the configured developer ID and authorized admin user IDs.
 * @param {import('wolf.js').WOLF} client - WOLF client instance
 * @param {import('wolf.js').CommandContext} command - Command context with request details
 * @returns {Promise<Response<MessageResponse>>} Response with list of refreshed groups or unauthorized message
 */
export default async (client, command) => {
  if (!isAuthorizedAdmin(client, command.sourceSubscriberId)) {
    return command.reply(client.phrase.getByCommandAndName(command, 'dice_admin_unauthorized'));
  }
  const names = await refreshUnsetGroup(client);
  const phrase = client.phrase.getByCommandAndName(command, 'dice_admin_groups_refreshed');
  const content = client.utility.string.replace(phrase, { list: names.join('\n') });

  return command.reply(content);
};
