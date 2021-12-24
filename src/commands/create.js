const WOLF = require("wolf.js");
const { api, game } = require("../../bot");

const COMMAND_TRIGER = `${api.config.keyword}_create_command`;
const COMMAND_RESPONSE = `${api.config.keyword}_create_message`;

Create = async (api, command) => {
  const user = await api.subscriber().getById(command.sourceSubscriberId);
  await game.create(command.targetGroupId, command.language, command.argument, user);
};

module.exports = new WOLF.Command(COMMAND_TRIGER, {
  group: (command) => Create(api, command),
});
