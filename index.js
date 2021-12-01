const { api } = require("./bot");
const commands = require("./src/commands");
api.commandHandler().register([commands]);
