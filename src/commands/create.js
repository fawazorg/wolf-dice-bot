const WOLF = require("@dawalters1/wolf.js");
const { api, game } = require("../../bot");

const COMMAND_TRIGER = `${api.config.keyword}_create_command`;
const COMMAND_RESPONSE = `${api.config.keyword}_create_message`;

Create = async (api, command) => {
  await game.create(command.targetGroupId, command.language, command.argument);
};

module.exports = new WOLF.Command(COMMAND_TRIGER, {
  group: (command) => Create(api, command),
});
