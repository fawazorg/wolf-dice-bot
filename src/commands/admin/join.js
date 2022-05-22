const { Validator, Command } = require("wolf.js");
const { api } = require("../../../bot");

const COMMAND_TRIGGER = `${api.config.keyword}_admin_join_command`;

/**
 *
 * @param {import('wolf.js').WOLFBot} api
 * @param {import('wolf.js').CommandObject} command
 */
const Join = async (api, command) => {
  const jm = api.phrase().getByCommandAndName(command, `${api.config.keyword}_join_message`);
  if (command.sourceSubscriberId !== 12500068) {
    return await api.messaging().sendMessage(command, jm[1]);
  }
  let [roomID, password] = command.argument.split(" ");
  roomID = api.utility().number().toEnglishNumbers(roomID);
  if (!Validator.isValidNumber(roomID)) {
    return await api.messaging().sendMessage(command, jm[2]);
  }
  let response = await api.group().joinById(parseInt(roomID), password);
  if (response.code === 403) {
    if (response.headers.subCode === 110) {
      return await api.messaging().sendMessage(command, jm[4]);
    } else if (response.headers.subCode === 4) {
      return await api.messaging().sendMessage(command, jm[5]);
    }
    return await api.messaging().sendMessage(command, response.headers.message);
  }
  if (response.code === 404) {
    return await api.messaging().sendMessage(command, jm[6]);
  }
  if (response.code === 401) {
    if (response.headers.subCode === 1) {
      return await api.messaging().sendMessage(command, jm[3]);
    }
    return await api.messaging().sendMessage(command, response.headers.message);
  }
  if (response.headers.subCode === 4) {
    return await api.messaging().sendMessage(command, jm[5]);
  }
  return await api.messaging().sendMessage(command, jm[0]);
};

module.exports = new Command(COMMAND_TRIGGER, {
  private: (command) => Join(api, command),
});
