import { Schema, model } from "mongoose";

const PlayerSchema = new Schema({
  id: { type: Number, unique: true, required: true },
  score: { type: Number, default: 0 },
  status: [
    {
      key: { type: Number, required: true },
      value: { type: Number, default: 0 },
    },
  ],
});

PlayerSchema.statics.increaseStatus = async function (playerID, key) {
  const result = await this.findOneAndUpdate(
    { id: playerID, "status.key": key },
    { $inc: { "status.$.value": 1 } },
    { new: true },
  );

  if (!result) {
    return this.findOneAndUpdate(
      { id: playerID },
      { $push: { status: { key, value: 1 } } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  return result;
};

export default model("Player", PlayerSchema);
