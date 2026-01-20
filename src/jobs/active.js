/**
 * @fileoverview Inactive group cleanup job.
 * Automatically removes the bot from groups with no activity after a specified period.
 * @module jobs/active
 */

import { deleteGroup, getInactiveGroups } from "../dice/active.js";
import { AdminGroup, ignoreGroups } from "../dice/data.js";

/**
 * Leave groups that have been inactive for a specified number of days.
 * Sends goodbye messages, removes the bot from inactive groups, and logs the cleanup to the admin group.
 * Excluded groups (in ignoreGroups config) are never left.
 * @param {import ("wolf.js").WOLF} api - WOLF client instance
 * @param {number} days - Number of days of inactivity before leaving a group
 * @returns {Promise<void>}
 */
const leaveInactiveGroups = async (api, days) => {
  const inactiveGroups = await getInactiveGroups(days);

  if (inactiveGroups.length <= 0) {
    return;
  }

  const inGroups = await api.channel().list();

  if (inGroups.length <= 0) {
    return;
  }

  const toExitGroups = [];

  inGroups.forEach((group) => {
    if (!ignoreGroups.includes(group.id) && inArray(inactiveGroups, "gid", group.id)) {
      toExitGroups.push(group);
    }
  });

  if (toExitGroups.length > 0) {
    const groupsNames = await toExitGroups.reduce(async (pv, group) => {
      const names = await pv;

      await sendLeaveMessage(api, group);
      await api.group().leaveById(group.id);
      await deleteGroup(group.id);
      await api.utility().delay(2000);

      return [...names, `[${group.name}]`];
    }, []);

    await sendLogMessage(api, groupsNames);
  }
};
/**
 * Send a goodbye message to a group before leaving.
 * Uses the group's language (Arabic or English) for the message.
 * @param {import ("wolf.js").WOLF} api - WOLF client instance
 * @param {import ("wolf.js").Channel} group - Group to send the message to
 * @returns {Promise<void>}
 */
const sendLeaveMessage = async (api, group) => {
  const language = group.language === "ar" ? "ar" : "en";
  const phrase = api.phrase().getByLanguageAndName(language, "dice_auto_leave_message");

  await api.messaging().sendGroupMessage(group.id, phrase);
};
/**
 * Send a log message to the admin group summarizing the cleanup operation.
 * Includes the count of groups left and the total remaining groups.
 * @param {import ("wolf.js").WOLF} api - WOLF client instance
 * @param {Array<string>} names - Array of group names that were left
 * @returns {Promise<void>}
 */
const sendLogMessage = async (api, names) => {
  const phrase = api.phrase().getByLanguageAndName("ar", "dice_auto_leave_log");
  const groupsCount = await api.channel().list();
  const content = api
    .utility()
    .string()
    .replace(phrase, {
      count: groupsCount.length,
      inactiveCount: names.length,
      groupsName: names.join("\n")
    });

  await api.messaging().sendGroupMessage(AdminGroup, content);
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
