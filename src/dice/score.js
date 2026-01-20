/**
 * @fileoverview Player scoring and ranking helpers.
 * Provides functions for managing player scores, rankings, and leaderboards.
 * @module dice/score
 */

import Player from "../database/models/player.js";

/**
 * Add points to a player's score.
 * Creates the player if they don't exist in the database.
 * @param {number} id - Player's unique ID
 * @param {number} points - Number of points to add (can be negative to subtract)
 * @returns {Promise<boolean>} True if the operation was successful
 */
const addPoint = async (id, points) => {
  try {
    const updatedPlayer = await Player.findOneAndUpdate(
      { id },
      { $inc: { score: points } },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    return !!updatedPlayer; // Returns true if successful
  } catch (err) {
    console.error(`Error adding points to player ${id}:`, err);
    throw err;
  }
};
/**
 * Get a player's rank and score data.
 * Uses MongoDB aggregation to calculate global rank based on score sorting.
 * @param {number} subscriberId - Player's unique ID
 * @returns {Promise<{id: number, score: number, GlobalRank: number}|null>} Player data with global rank, or null if not found
 */
const getPlayerRankData = async (subscriberId) => {
  const [data] = await Player.aggregate([
    {
      $setWindowFields: {
        sortBy: { score: -1 },
        output: {
          GlobalRank: { $documentNumber: {} }
        }
      }
    },
    { $match: { id: subscriberId } }
  ]);

  return data || null;
};

/**
 * Get the top 10 players by score.
 * Returns players sorted by score in descending order.
 * @returns {Promise<Array<{id: number, score: number}>>} Array of top 10 players
 */
const getTopPlayers = async () => {
  return Player.find().sort({ score: -1 }).limit(10).lean(); // Use .lean() for faster, read-only performance
};
/**
 * Update a player's status field by incrementing it.
 * Creates the player if they don't exist in the database.
 * @param {number} playerID - Player's unique ID
 * @param {string} key - Status field name to increment
 * @returns {Promise<void>}
 */
const updateStatus = async (playerID, key) => {
  await Player.findOneAndUpdate(
    { id: playerID },
    { $inc: { [key]: 1 } }, // Dynamic key increment
    { upsert: true, setDefaultsOnInsert: true }
  );
};

export { addPoint, getPlayerRankData, getTopPlayers, updateStatus };
