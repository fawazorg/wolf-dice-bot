const { Validator, Command } = require("wolf.js");
const { api } = require("../../bot");

const COMMAND_TRIGER = `${api.config.keyword}_command_join`;

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
  let respoens = await api.group().joinById(parseInt(roomID), password);
  if (respoens.code === 403) {
    if (respoens.headers.subCode === 110) {
      return await api.messaging().sendMessage(command, jm[4]);
    } else if (respoens.headers.subCode === 4) {
      return await api.messaging().sendMessage(command, jm[5]);
    }
    return await api.messaging().sendMessage(command, respoens.headers.message);
  }
  if (respoens.code === 404) {
    return await api.messaging().sendMessage(command, jm[6]);
  }
  if (respoens.code === 401) {
    if (respoens.headers.subCode === 1) {
      return await api.messaging().sendMessage(command, jm[3]);
    }
    return await api.messaging().sendMessage(command, respoens.headers.message);
  }
  if (respoens.headers.subCode === 4) {
    return await api.messaging().sendMessage(command, jm[5]);
  }
  return await api.messaging().sendMessage(command, jm[0]);
};

module.exports = new Command(COMMAND_TRIGER, {
  private: (command) => Join(api, command),
});
