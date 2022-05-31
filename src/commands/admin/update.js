const { Validator, Command } = require("wolf.js");
const { api } = require("../../../bot");
const { admins } = require("../../dice/data");
const COMMAND_TRIGGER = `${api.config.keyword}_admin_update_command`;
const COMMAND_RESPONSE = `${api.config.keyword}_admin_update_message`;
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
  const status = command.argument;
  try {
    await api.updateProfile().setStatus(status).save();
    let phrase = api.phrase().getByCommandAndName(command, COMMAND_RESPONSE);
    let content = api.utility().string().replace(phrase, { status });
    return await api.messaging().sendMessage(command, content);
  } catch (error) {
    
  }
};

module.exports = new Command(COMMAND_TRIGGER, {
  group: (command) => Count(api, command),
});
