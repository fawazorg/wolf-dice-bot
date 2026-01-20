/**
 * @fileoverview Authorization utilities for admin commands.
 * Provides centralized logic for checking if a user has admin privileges.
 * @module utils/authorization
 */

import { getAdminIds } from "./config.js";

/**
 * Check if a user is authorized to execute admin commands.
 * A user is authorized if they are either:
 * - The configured developer (from config)
 * - Listed in the admins array from environment variables
 * @param {import('wolf.js').WOLF} client - WOLF client instance
 * @param {number} subscriberId - ID of the user to check
 * @returns {boolean} True if user is authorized
 */
export const isAuthorizedAdmin = (client, subscriberId) => {
  const isDeveloper = subscriberId === client.config.app.developerId;
  const isAdmin = getAdminIds().includes(subscriberId);
  return isDeveloper || isAdmin;
};
