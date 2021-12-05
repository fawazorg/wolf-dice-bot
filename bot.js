const constant = require("@dawalters1/constants");
const { WOLFBot, Constants } = require("wolf.js");
const api = new WOLFBot();
const { UpdateTimer } = require("./src/jobs/group");
const Game = require("./src/dice/game");

require("dotenv").config();

const game = new Game(api);

module.exports = { api, game };

api.on("ready", async () => {
  console.log("[*] - dice start.");
  await api.utility().timer().initialise({ UpdateTimer: UpdateTimer }, game);
});

api.login(process.env.EMAIL, process.env.PASSWORD, Constants.LoginDevice.WEB);
