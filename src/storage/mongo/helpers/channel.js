/**
 * @fileoverview Channel database helper functions.
 * Provides functions for tracking channel activity and managing inactive channels.
 * @module database/helpers/channel
 */

import Channel from "../models/channel.js";

/**
 * Set the last active timestamp for a channel to the current time.
 * Creates the channel record if it doesn't exist.
 * @param {number} channelId - Channel ID
 * @returns {Promise<void>}
 */
export const setLastActive = async (channelId) => {
  await Channel.findOneAndUpdate({ channelId }, { lastActiveAt: new Date() }, { upsert: true });
};

/**
 * Get channels that have been inactive for more than a specified number of days.
 * Uses MongoDB aggregation to calculate the day difference between last active time and now.
 * @param {number} daysPass - Minimum number of days of inactivity to filter by
 * @returns {Promise<Array<{channelId: number, days: number}>>} Array of inactive channels with their inactivity duration
 */
export const getInactiveChannels = async (daysPass) => {
  const channels = await Channel.aggregate([
    {
      $project: {
        channelId: "$channelId",
        days: {
          $dateDiff: {
            startDate: "$lastActiveAt",
            endDate: "$$NOW",
            unit: "day"
          }
        }
      }
    },
    { $match: { days: { $gt: daysPass } } }
  ]);

  return channels;
};

/**
 * Delete a channel record from the database.
 * Typically called when the bot leaves a channel.
 * @param {number} channelId - Channel ID to delete
 * @returns {Promise<void>}
 */
export const deleteChannel = async (channelId) => {
  await Channel.findOneAndDelete({ channelId });
};

/**
 * Refresh activity timestamps for all channels the bot is currently in.
 * Used by admin refresh command to prevent premature cleanup of all channels.
 * @param {import ("wolf.js").WOLF} client - WOLF client instance
 * @returns {Promise<Array<string>>} Array of channel names that were refreshed
 */
export const refreshUnsetChannels = async (client) => {
  const channels = await client.channel.list();
  return channels.reduce(async (pv, channel) => {
    const names = await pv;

    await setLastActive(channel.id);

    return [...names, `[${channel.name}]`];
  }, Promise.resolve([]));
};

/**
 * Get inactivity information for a specific channel.
 * Returns the last active timestamp and days since last activity.
 * @param {number} channelId - Channel ID to check
 * @returns {Promise<{lastActiveAt: Date, days: number} | null>} Channel activity data or null if not found
 */
export const getChannelInactivity = async (channelId) => {
  const result = await Channel.aggregate([
    { $match: { channelId } },
    {
      $project: {
        lastActiveAt: "$lastActiveAt",
        days: {
          $dateDiff: {
            startDate: "$lastActiveAt",
            endDate: "$$NOW",
            unit: "day"
          }
        }
      }
    }
  ]);

  return result.length > 0 ? result[0] : null;
};
