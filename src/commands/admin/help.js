const WOLF = require("wolf.js");
const { api } = require("../../../bot");

const COMMAND_TRIGGER = `${api.config.keyword}_help_command`;
const COMMAND_RESPONSE = `${api.config.keyword}_help_admin_message`;

HelpAdmin = async (api, command) => {
  let okay = command.sourceSubscriberId === api.options.developerId;
  if (!okay) {
    let phrase = api.phrase().getByCommandAndName(command, COMMAND_NOT_AUTHORIZES);
    return await api.messaging().sendMessage(command, phrase);
  }
  await api
    .messaging()
    .sendMessage(
      command,
      api.phrase().getByLanguageAndName(command.language, COMMAND_RESPONSE).join("\n")
    );
};

module.exports = new WOLF.Command(COMMAND_TRIGGER, {
  both: (command) => HelpAdmin(api, command),
});
