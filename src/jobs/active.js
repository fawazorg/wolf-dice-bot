/**
 * @fileoverview Inactive channel cleanup job.
 * Automatically removes the bot from channels with no activity after a specified period.
 * @module jobs/active
 */

import { deleteChannel, getInactiveChannels } from "../storage/mongo/helpers/channel.js";
import { getAdminChannelId, getIgnoreChannelIds } from "../utils/config.js";

/**
 * Leave channels that have been inactive for a specified number of days.
 * Sends goodbye messages, removes the bot from inactive channels, and logs the cleanup to the admin channel.
 * Excluded channels (in ignoreChannels config) are never left.
 * @param {import ("wolf.js").WOLF} client - WOLF client instance
 * @param {number} days - Number of days of inactivity before leaving a channel
 * @returns {Promise<void>}
 */
const leaveInactiveChannels = async (client, days) => {

  const inactiveChannels = await getInactiveChannels(days);

  if (inactiveChannels.length <= 0) {
    return Promise.resolve();
  }

  const inChannels = await client.channel.list();

  if (inChannels.length <= 0) {
    return Promise.resolve();
  }

  const toExitChannels = [];

  const ignoreChannels = getIgnoreChannelIds(client);
  inChannels.forEach((channel) => {
    if (!ignoreChannels.includes(channel.id) && inArray(inactiveChannels, "channelId", channel.id)) {
      toExitChannels.push(channel);
    }
  });
  if (toExitChannels.length > 0) {
    const channelsNames = await toExitChannels.reduce(async (pv, channel) => {
      const names = await pv;

      await sendLeaveMessage(client, channel);
      await client.channel.leaveById(channel.id);
      await deleteChannel(channel.id);
      await client.utility.delay(2000);

      return [...names, `[${channel.name}]`];
    }, []);

    await sendLogMessage(client, channelsNames);
  }
};
/**
 * Send a goodbye message to a channel before leaving.
 * Uses the channel's language (Arabic or English) for the message.
 * @param {import ("wolf.js").WOLF} client - WOLF client instance
 * @param {import ("wolf.js").Channel} channel - Channel to send the message to
 * @returns {Promise<void>}
 */
const sendLeaveMessage = async (client, channel) => {
  const language = channel.language === "ar" ? "ar" : "en";
  const phrase = client.phrase.getByLanguageAndName(language, "dice_auto_leave_message");

  await client.messaging.sendChannelMessage(channel.id, phrase);
};
/**
 * Send a log message to the admin channel summarizing the cleanup operation.
 * Includes the count of channels left and the total remaining channels.
 * @param {import ("wolf.js").WOLF} client - WOLF client instance
 * @param {Array<string>} names - Array of channel names that were left
 * @returns {Promise<void>}
 */
const sendLogMessage = async (client, names) => {
  const phrase = client.phrase.getByLanguageAndName("ar", "dice_maintenance_report");
  const channelsCount = await client.channel.list();
  const content = client
    .utility
    .string
    .replace(phrase, {
      count: channelsCount.length,
      inactiveCount: names.length,
      channelsName: names.join("\n")
    });

  const adminChannelId = getAdminChannelId(client);
  if (adminChannelId) {
    await client.messaging.sendChannelMessage(adminChannelId, content);
  }
};
/**
 * Check if an array contains an object with a specific key-value pair.
 * @param {Array<Object>} array - Array of objects to search
 * @param {string} key - Property name to check
 * @param {*} value - Value to match
 * @returns {boolean} True if a matching object is found
 */
const inArray = (array, key, value) => {
  return array.filter((item) => item[key] === value).length > 0;
};

export { leaveInactiveChannels };
