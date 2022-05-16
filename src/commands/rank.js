const WOLF = require("wolf.js");
const { api } = require("../../bot");
const { myRank } = require("../dice/score");
const COMMAND_TRIGER = `${api.config.keyword}_rank_command`;

Rank = async (api, command) => {
  return await myRank(command, api);
};

module.exports = new WOLF.Command(COMMAND_TRIGER, {
  group: (command) => Rank(api, command),
});
