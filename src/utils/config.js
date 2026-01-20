/**
 * @fileoverview Environment configuration utilities.
 * Provides centralized access to environment variables with proper parsing.
 * @module utils/config
 */

/**
 * Parse comma-separated list of admin IDs from environment variable.
 * @returns {number[]} Array of admin user IDs
 */
export const getAdminIds = () => {
  const adminIds = process.env.ADMIN_IDS || "";
  return adminIds.split(",").map((id) => parseInt(id.trim())).filter((id) => !isNaN(id));
};

/**
 * Get admin group ID from environment variable.
 * @returns {number|null} Admin group ID or null if not set
 */
export const getAdminGroupId = () => {
  const groupId = process.env.ADMIN_GROUP_ID;
  return groupId ? parseInt(groupId) : null;
};

/**
 * Parse comma-separated list of group IDs to ignore from environment variable.
 * @returns {number[]} Array of group IDs to ignore
 */
export const getIgnoreGroupIds = () => {
  const ignoreIds = process.env.IGNORE_GROUP_IDS || "";
  return ignoreIds.split(",").map((id) => parseInt(id.trim())).filter((id) => !isNaN(id));
};
