const WOLF = require("wolf.js");
const { api, game } = require("../../bot");

const COMMAND_TRIGGER = `${api.config.keyword}_balance_command`;

Balance = async (api, command) => {
  await game.balance(command);
};

module.exports = new WOLF.Command(COMMAND_TRIGGER, {
  group: (command) => Balance(api, command),
});
