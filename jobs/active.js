import { deleteGroup, getInactiveGroups } from "../dice/active.js";
import { AdminGroup, ignoreGroups } from "../dice/data.js";
/**
 *
 * @param {import ("wolf.js").WOLF} api
 * @param {Number} days
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
 *
 * @param {import ("wolf.js").WOLF} api
 * @param {import ("wolf.js").Channel} group
 */
const sendLeaveMessage = async (api, group) => {
  const language = group.language === "ar" ? "ar" : "en";
  const phrase = api.phrase().getByLanguageAndName(language, "dice_auto_leave_message");

  await api.messaging().sendGroupMessage(group.id, phrase);
};
/**
 *
 * @param {import ("wolf.js").WOLF} api
 * @param {Array} names
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
 *
 * @param {Array} array
 * @param {String} key
 * @param {*} value
 * @returns
 */
const inArray = (array, key, value) => {
  return array.filter((item) => item[key] === value).length > 0;
};

export { leaveInactiveGroups };
