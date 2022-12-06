const mongoose = require("mongoose");
const findOrCreate = require("mongoose-find-or-create");

const Schema = mongoose.Schema;

const PlayerSchema = new Schema(
  {
    id: { type: Number, unique: true },
    score: { type: Number, default: 0 },
    status: [{ key: { type: Number, default: 1 }, value: { type: Number, default: 0 } }],
  },
  {
    methods: {
      async increase(key) {
        const item = this.status.find((item) => item.key == key);
        if (!item) {
          this.status.push({ key, value: 1 });
        } else {
          item.value += 1;
        }
        await this.save();
      },
    },
  }
);

PlayerSchema.plugin(findOrCreate);

const Player = mongoose.model("Player", PlayerSchema);

module.exports = Player;
