/**
 * @fileoverview Group database helper functions.
 * Provides functions for tracking group activity and managing inactive groups.
 * @module database/helpers/group
 */

import Group from '../models/group.js';

/**
 * Set the last active timestamp for a group to the current time.
 * Creates the group record if it doesn't exist.
 * @param {number} gid - Group/channel ID
 * @returns {Promise<void>}
 */
export const setLastActive = async (gid) => {
  await Group.findOneAndUpdate({ gid }, { lastActiveAt: new Date() }, { upsert: true });
};

/**
 * Get groups that have been inactive for more than a specified number of days.
 * Uses MongoDB aggregation to calculate the day difference between last active time and now.
 * @param {number} daysPass - Minimum number of days of inactivity to filter by
 * @returns {Promise<Array<{gid: number, days: number}>>} Array of inactive groups with their inactivity duration
 */
export const getInactiveGroups = async (daysPass) => {
  const groups = await Group.aggregate([
    {
      $project: {
        gid: '$gid',
        days: {
          $dateDiff: {
            startDate: '$lastActiveAt',
            endDate: '$$NOW',
            unit: 'day'
          }
        }
      }
    },
    { $match: { days: { $gt: daysPass } } }
  ]);

  return groups;
};

/**
 * Delete a group record from the database.
 * Typically called when the bot leaves a group.
 * @param {number} gid - Group/channel ID to delete
 * @returns {Promise<void>}
 */
export const deleteGroup = async (gid) => {
  await Group.findOneAndDelete({ gid });
};

/**
 * Refresh activity timestamps for all groups the bot is currently in.
 * Used by admin refresh command to prevent premature cleanup of all groups.
 * @param {import ("wolf.js").WOLF} api - WOLF client instance
 * @returns {Promise<Array<string>>} Array of group names that were refreshed
 */
export const refreshUnsetGroup = async (api) => {
  const groups = await api.channel().list();
  const groupsNames = groups.reduce(async (pv, group) => {
    const names = await pv;

    await setLastActive(group.id);

    return [...names, `[${group.name}]`];
  }, []);

  return groupsNames;
};
