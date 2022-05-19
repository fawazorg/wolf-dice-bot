const WOLF = require("wolf.js");
const { api, game } = require("../../bot");

const COMMAND_TRIGGER = `${api.config.keyword}_create_command`;
const COMMAND_RESPONSE = `${api.config.keyword}_create_message`;

Create = async (api, command) => {
  await game.create(command, command.argument);
};

module.exports = new WOLF.Command(COMMAND_TRIGGER, {
  group: (command) => Create(api, command),
});
