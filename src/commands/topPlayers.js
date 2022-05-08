const WOLF = require("wolf.js");
const { api } = require("../../bot");
const { top10 } = require("../dice/score");
const COMMAND_TRIGER = `${api.config.keyword}_top_command`;

TopPlayers = async (api, command) => {
  return await top10(command, api);
};

module.exports = new WOLF.Command(COMMAND_TRIGER, {
  both: (command) => TopPlayers(api, command),
});