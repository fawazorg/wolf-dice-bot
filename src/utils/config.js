/**
 * @fileoverview Configuration utilities.
 * Provides centralized access to configuration values from the WOLF client config.
 * @module utils/config
 */

/**
 * Get admin IDs from client configuration.
 * @param {import('wolf.js').WOLF} client - WOLF client instance
 * @returns {number[]} Array of admin user IDs
 */
export const getAdminIds = (client) => {
  return client.config.admin?.adminIds || [];
};

/**
 * Get admin channel ID from client configuration.
 * @param {import('wolf.js').WOLF} client - WOLF client instance
 * @returns {number|null} Admin channel ID or null if not set
 */
export const getAdminChannelId = (client) => {
  return client.config.admin?.adminChannelId || null;
};

/**
 * Get channel IDs to ignore from client configuration.
 * @param {import('wolf.js').WOLF} client - WOLF client instance
 * @returns {number[]} Array of channel IDs to ignore
 */
export const getIgnoreChannelIds = (client) => {
  return client.config.admin?.ignoreChannelIds || [];
};
