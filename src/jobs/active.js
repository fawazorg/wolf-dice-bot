const { getInactiveGroups, deleteGroup } = require("../dice/active");
/**
 *
 * @param {import ("wolf.js").WOLFBot} api
 * @param {Number} days
 */
const leaveInactiveGroups = async (api, days) => {
  console.log("Job started");
  let inactiveGroups = await getInactiveGroups(days);
  inactiveGroups.reduce(async (pv, group) => {
    await pv;
    let inactiveGroup = await api.group().getById(group.gid);
    await sendLeaveMessage(api, inactiveGroup);
    await api.group().leaveById(group.gid);
    await sendLogMessage(api, inactiveGroup);
    await deleteGroup(group.gid);
    await api.utility().delay(2000);
  }, Promise.resolve());
};
/**
 *
 * @param {import ("wolf.js").WOLFBot} api
 * @param {import ("wolf.js").GroupObject} group
 */
const sendLeaveMessage = async (api, group) => {
  let language = group.language === "ar" ? "ar" : "en";
  let phrase = api.phrase().getByLanguageAndName(language, "dice_auto_leave_message");
  await api.messaging().sendGroupMessage(group.id, phrase);
};
/**
 *
 * @param {import ("wolf.js").WOLFBot} api
 * @param {import ("wolf.js").GroupObject} group
 */
const sendLogMessage = async (api, group) => {
  let language = group.language === "ar" ? "ar" : "en";
  let phrase = api.phrase().getByLanguageAndName(language, "dice_auto_leave_log");
  let groupsCount = await api.group().list();
  let content = api
    .utility()
    .string()
    .replace(phrase, { name: group.name, count: groupsCount.length - 1 });
  await api.messaging().sendPrivateMessage(api.options.developerId, content);
};
module.exports = { leaveInactiveGroups };
