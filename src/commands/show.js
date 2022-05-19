const WOLF = require("wolf.js");
const { api, game } = require("../../bot");

const COMMAND_TRIGGER = `${api.config.keyword}_show_command`;

Show = async (api, command) => {
  await game.show(command);
};

module.exports = new WOLF.Command(COMMAND_TRIGGER, {
  group: (command) => Show(api, command),
});
