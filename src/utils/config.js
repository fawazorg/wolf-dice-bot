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
 * Get admin group ID from client configuration.
 * @param {import('wolf.js').WOLF} client - WOLF client instance
 * @returns {number|null} Admin group ID or null if not set
 */
export const getAdminGroupId = (client) => {
  return client.config.admin?.adminGroupId || null;
};

/**
 * Get group IDs to ignore from client configuration.
 * @param {import('wolf.js').WOLF} client - WOLF client instance
 * @returns {number[]} Array of group IDs to ignore
 */
export const getIgnoreGroupIds = (client) => {
  return client.config.admin?.ignoreGroupIds || [];
};
