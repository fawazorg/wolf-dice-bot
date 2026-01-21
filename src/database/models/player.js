/**
 * @fileoverview Player database model.
 * Defines the Mongoose schema and model for storing player scores and statistics.
 * @module database/models/player
 */

import { Schema, model } from "mongoose";

/**
 * Mongoose schema for player data.
 * @typedef {Object} PlayerDocument
 * @property {number} id - Unique player ID from WOLF platform
 * @property {number} score - Total game score
 * @property {Array<{key: number, value: number}>} status - Array of status key-value pairs for tracking statistics
 */

/**
 * Player schema definition.
 * @type {Schema<PlayerDocument>}
 */
const PlayerSchema = new Schema({
  id: { type: Number, unique: true, required: true },
  score: { type: Number, default: 0 },
  status: [
    {
      key: { type: Number, required: true },
      value: { type: Number, default: 0 }
    }
  ]
});

/**
 * Increment a player's status counter by key.
 * If the status key doesn't exist, creates it with value 1.
 * If the player doesn't exist, creates the player with the status.
 *
 * @static
 * @param {number} playerID - The player's unique ID
 * @param {number} key - The status key to increment
 * @returns {Promise<PlayerDocument>} Updated or created player document
 */
PlayerSchema.statics.increaseStatus = async function (playerID, key) {
  const result = await this.findOneAndUpdate(
    { id: playerID, "status.key": key },
    { $inc: { "status.$.value": 1 } },
    { new: true }
  );

  if (!result) {
    return this.findOneAndUpdate(
      { id: playerID },
      { $push: { status: { key, value: 1 } } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  return result;
};

/**
 * Player model for database operations.
 * @type {import('mongoose').Model<PlayerDocument>}
 */
export default model("Player", PlayerSchema);
