const WOLF = require("wolf.js");
const { api } = require("../../bot");
const { status } = require("../dice/status");
const COMMAND_TRIGGER = "dice_status_command";

Status = async (api, command) => {
  await status(api, command);
};

module.exports = new WOLF.Command(COMMAND_TRIGGER, {
  group: (command) => Status(api, command),
});
