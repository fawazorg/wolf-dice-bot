const WOLF = require("@dawalters1/wolf.js");
const { api, game } = require("../../bot");

const COMMAND_TRIGER = `${api.config.keyword}_join_command`;

Join = async (api, command) => {
  const user = await api.subscriber().getById(command.sourceSubscriberId);
  await game.join(command, user);
};

module.exports = new WOLF.Command(COMMAND_TRIGER, {
  group: (command) => Join(api, command),
});
