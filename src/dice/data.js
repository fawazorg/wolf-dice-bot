/**
 * @fileoverview Bot configuration constants.
 * Defines admin users, special groups, and other configuration data.
 * @module dice/data
 */

/**
 * List of admin user IDs with elevated permissions.
 * These users can execute admin commands.
 * @type {number[]}
 */
const admins = [82366923];

/**
 * List of group IDs to ignore for certain bot operations.
 * @type {number[]}
 */
const ignoreGroups = [81967172];

/**
 * Special admin group ID for administrative notifications and operations.
 * @type {number}
 */
const AdminGroup = 81967172;

export { AdminGroup, admins, ignoreGroups };
