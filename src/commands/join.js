const WOLF = require("wolf.js");
const { api, game } = require("../../bot");

const COMMAND_TRIGGER = `${api.config.keyword}_join_command`;

Join = async (api, command) => {
  await game.join(command);
};

module.exports = new WOLF.Command(COMMAND_TRIGGER, {
  group: (command) => Join(api, command),
});
