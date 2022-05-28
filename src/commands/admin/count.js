const { Validator, Command } = require("wolf.js");
const { api } = require("../../../bot");
const { admins } = require("../../dice/data");
const COMMAND_TRIGGER = `${api.config.keyword}_admin_count_command`;
const COMMAND_RESPONSE = `${api.config.keyword}_admin_count_message`;
const COMMAND_NOT_AUTHORIZES = `${api.config.keyword}_admin_not_authorized_message`;

/**
 *
 * @param {import('wolf.js').WOLFBot} api
 * @param {import('wolf.js').CommandObject} command
 */
const Count = async (api, command) => {
  const isDeveloper = command.sourceSubscriberId === api.options.developerId;
  const isAdmin = admins.includes(command.sourceSubscriberId);
  const okay = isDeveloper || isAdmin;
  if (!okay) {
    let phrase = api.phrase().getByCommandAndName(command, COMMAND_NOT_AUTHORIZES);
    return await api.messaging().sendMessage(command, phrase);
  }
  let count = (await api.group().list()).length;
  let phrase = api.phrase().getByCommandAndName(command, COMMAND_RESPONSE);
  let content = api.utility().string().replace(phrase, { count });
  return await api.messaging().sendMessage(command, content);
};

module.exports = new Command(COMMAND_TRIGGER, {
  group: (command) => Count(api, command),
});
