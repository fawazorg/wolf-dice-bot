const WOLF = require("wolf.js");
const { api } = require("../../bot");

const COMMAND_TRIGER = `${api.config.keyword}_help_command`;
const COMMAND_RESPONSE = `${api.config.keyword}_help_message`;

Help = async (api, command) => {
  await api
    .messaging()
    .sendMessage(command, api.phrase().getByLanguageAndName(command.language, COMMAND_RESPONSE));
};

module.exports = new WOLF.Command(COMMAND_TRIGER, {
  both: (command) => Help(api, command),
});
