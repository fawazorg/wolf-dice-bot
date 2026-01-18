import Player from "../models/player.js";

/**
 * add points to player
 * @param {number} id
 * @param {number} points
 * @returns {Promise<boolean>}
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
 *  get player rank data
 * @param {number} subscriberId
 * @returns {Promise<Object|null>}
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
 * get top 10 players
 * @returns {Promise<Array>}
 */
const getTopPlayers = async () => {
  return Player.find().sort({ score: -1 }).limit(10).lean(); // Use .lean() for faster, read-only performance
};
/**
 * update player status
 * @param {number} playerID
 * @param {string} key
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
