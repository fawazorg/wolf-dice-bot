const mongoose = require("mongoose");
const findOrCreate = require("mongoose-find-or-create");

const Schema = mongoose.Schema;

const GroupSchema = new Schema({
  gid: { type: Number, unique: true },
  lastActiveAt: { type: Date, default: new Date() },
});

GroupSchema.plugin(findOrCreate);

const Group = mongoose.model("Group", GroupSchema);

module.exports = Group;
