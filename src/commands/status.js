/**
 * @fileoverview Status command handler.
 * Handles the `!dice status` command to display dice roll statistics.
 * Shows comprehensive statistics about a player's dice rolls and game performance.
 * @module commands/status
 */

import Player from '../database/models/player.js';

/**
 * Calculate the total of all values in a status array.
 * @param {Array<{key: number, value: number}>} arr - Array of status key-value pairs
 * @returns {number} Sum of all values
 */
const getTotal = (arr = []) => arr.reduce((prev, num) => prev + num.value, 0);

/**
 * Get the percentage for a specific status key.
 * @param {Array<{key: number, value: number, percentage?: string}>} arr - Array with calculated percentages
 * @param {number} key - The status key to look up
 * @returns {string} Percentage string (e.g., "25%") or "0%" if not found
 */
const getByKey = (arr = [], key) => arr.find((item) => item.key === key)?.percentage || '0%';

/**
 * Calculate percentage distribution for all status items.
 * Adds a percentage field to each item based on its value relative to the total.
 * @param {Array<{key: number, value: number}>} arr - Array of status key-value pairs
 * @returns {Array<{key: number, value: number, percentage: string}>} Array with percentage field added
 */
const getPercentage = (arr = []) => {
  const total = getTotal(arr);
  const percentage = arr.reduce((prev, item) => {
    item.percentage = `${((item.value / total) * 100).toFixed(0)}%`;

    return [...prev, item];
  }, []);

  return percentage;
};

/**
 * Handle the status query command.
 * Displays detailed statistics about the requesting player's dice roll history,
 * including total rolls, win rate, and other performance metrics.
 * @param {import('wolf.js').WOLF} client - WOLF client instance
 * @param {import('wolf.js').CommandContext} command - Command context with request details
 * @returns {Promise<Response<MessageResponse>>} Response with player statistics
 */
export default async (client, command) => {
  const player = await Player.findOne({ id: command.sourceSubscriberId });
  if (!player || player.status.length <= 0) {
    const phrase = client.phrase.getByCommandAndName(command, 'dice_player_no_statistics');

    return command.reply(phrase);
  }

  const percentage = getPercentage(player.status);
  const phrase = client.phrase.getByCommandAndName(command, 'dice_player_statistics');
  const text = client.utility.string.replace(phrase, {
    d1: getByKey(percentage, 1),
    d2: getByKey(percentage, 2),
    d3: getByKey(percentage, 3),
    d4: getByKey(percentage, 4),
    d5: getByKey(percentage, 5),
    d6: getByKey(percentage, 6)
  });

  return command.reply(text);
};
