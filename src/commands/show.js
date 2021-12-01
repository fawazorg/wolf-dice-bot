const WOLF = require("@dawalters1/wolf.js");
const { api, game } = require("../../bot");

const COMMAND_TRIGER = `${api.config.keyword}_show_command`;

Show = async (api, command) => {
  await game.show(command);
};

module.exports = new WOLF.Command(COMMAND_TRIGER, {
  group: (command) => Show(api, command),
});
