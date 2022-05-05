const mongoose = require("mongoose");
const findOrCreate = require("mongoose-find-or-create");

const Schema = mongoose.Schema;

const PlayerSchema = new Schema({
  id: { type: Number, unique: true },
  score: { type: Number, default: 0 },
});

PlayerSchema.plugin(findOrCreate);

const Player = mongoose.model("Player", PlayerSchema);

module.exports = Player;
