const mongoose = require("mongoose");
const { WOLFBot } = require("wolf.js");
const { UpdateTimer } = require("./src/jobs/group");
const Game = require("./src/dice/game");
require("dotenv").config();

mongoose.connect(
  `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PWD}@127.0.0.1/${process.env.MONGO_DB_NAME}`,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

mongoose.Promise = global.Promise;
const db = mongoose.connection;

const api = new WOLFBot();
const game = new Game(api);

module.exports = { api, game };

db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
  console.log("[*] Database is a live!");
});

api.on("ready", async () => {
  console.log("[*] - dice start.");
  await api.utility().timer().initialise({ UpdateTimer: UpdateTimer }, game);
});

api.login(process.env.EMAIL, process.env.PASSWORD);
