/**
 * @fileoverview Inactive group cleanup job.
 * Automatically removes the bot from groups with no activity after a specified period.
 * @module jobs/active
 */

import { deleteGroup, getInactiveGroups } from "../database/helpers/group.js";
import { getAdminGroupId, getIgnoreGroupIds } from "../utils/config.js";

/**
 * Leave groups that have been inactive for a specified number of days.
 * Sends goodbye messages, removes the bot from inactive groups, and logs the cleanup to the admin group.
 * Excluded groups (in ignoreGroups config) are never left.
 * @param {import ("wolf.js").WOLF} client - WOLF client instance
 * @param {number} days - Number of days of inactivity before leaving a group
 * @returns {Promise<void>}
 */
const leaveInactiveGroups = async (client, days) => {
  const inactiveGroups = await getInactiveGroups(days);

  if (inactiveGroups.length <= 0) {
    return;
  }

  const inGroups = await client.channel().list();

  if (inGroups.length <= 0) {
    return;
  }

  const toExitGroups = [];

  const ignoreGroups = getIgnoreGroupIds(client);
  inGroups.forEach((group) => {
    if (!ignoreGroups.includes(group.id) && inArray(inactiveGroups, "gid", group.id)) {
      toExitGroups.push(group);
    }
  });

  if (toExitGroups.length > 0) {
    const groupsNames = await toExitGroups.reduce(async (pv, group) => {
      const names = await pv;

      await sendLeaveMessage(client, group);
      await client.group().leaveById(group.id);
      await deleteGroup(group.id);
      await client.utility().delay(2000);

      return [...names, `[${group.name}]`];
    }, []);

    await sendLogMessage(client, groupsNames);
  }
};
/**
 * Send a goodbye message to a group before leaving.
 * Uses the group's language (Arabic or English) for the message.
 * @param {import ("wolf.js").WOLF} client - WOLF client instance
 * @param {import ("wolf.js").Channel} group - Group to send the message to
 * @returns {Promise<void>}
 */
const sendLeaveMessage = async (client, group) => {
  const language = group.language === "ar" ? "ar" : "en";
  const phrase = client.phrase().getByLanguageAndName(language, "dice_auto_leave_message");

  await client.messaging().sendGroupMessage(group.id, phrase);
};
/**
 * Send a log message to the admin group summarizing the cleanup operation.
 * Includes the count of groups left and the total remaining groups.
 * @param {import ("wolf.js").WOLF} client - WOLF client instance
 * @param {Array<string>} names - Array of group names that were left
 * @returns {Promise<void>}
 */
const sendLogMessage = async (client, names) => {
  const phrase = client.phrase().getByLanguageAndName("ar", "dice_maintenance_report");
  const groupsCount = await client.channel().list();
  const content = client
    .utility()
    .string()
    .replace(phrase, {
      count: groupsCount.length,
      inactiveCount: names.length,
      groupsName: names.join("\n")
    });

  const adminGroupId = getAdminGroupId(client);
  if (adminGroupId) {
    await client.messaging().sendGroupMessage(adminGroupId, content);
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

export { leaveInactiveGroups };
