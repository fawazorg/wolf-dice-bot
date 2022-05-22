const { Command } = require("wolf.js");
const { api } = require("../../../bot");
const { refreshUnsetGroup } = require("../../dice/active");

const COMMAND_TRIGGER = `${api.config.keyword}_admin_refresh_command`;
const COMMAND_RESPONSE = `${api.config.keyword}_admin_refresh_message`;
const COMMAND_NOT_AUTHORIZES = `${api.config.keyword}_admin_not_authorized_message`;
/**
 *
 * @param {import('wolf.js').WOLFBot} api
 * @param {import('wolf.js').CommandObject} command
 */
const Refresh = async (api, command) => {
  // TODO: change that
  let okay = command.sourceSubscriberId === api.options.developerId;
  if (!okay) {
    let phrase = api.phrase().getByCommandAndName(command, COMMAND_NOT_AUTHORIZES);
    return await api.messaging().sendMessage(command, phrase);
  }
  let names = await refreshUnsetGroup(api);
  let phrase = api.phrase().getByCommandAndName(command, COMMAND_RESPONSE);
  let content = api
    .utility()
    .string()
    .replace(phrase, { list: names.join("\n") });
  await api.messaging().sendMessage(command, content);
};
module.exports = new Command(COMMAND_TRIGGER, {
  group: (command) => Refresh(api, command),
});
