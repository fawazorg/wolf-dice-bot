/**
 * @fileoverview Statistics utility functions.
 * Provides helper functions for calculating and formatting dice roll statistics.
 * @module utils/statistics
 */

/**
 * Calculate the total of all values in a status array.
 * @param {Array<{key: number, value: number}>} arr - Array of status key-value pairs
 * @returns {number} Sum of all values
 */
export const getTotal = (arr = []) => arr.reduce((prev, num) => prev + num.value, 0);

/**
 * Get the percentage for a specific status key.
 * @param {Array<{key: number, value: number, percentage?: string}>} arr - Array with calculated percentages
 * @param {number} key - The status key to look up
 * @returns {string} Percentage string (e.g., "25%") or "0%" if not found
 */
export const getByKey = (arr = [], key) =>
  arr.find((item) => item.key === key)?.percentage || "0%";

/**
 * Calculate percentage distribution for all status items.
 * Adds a percentage field to each item based on its value relative to the total.
 * @param {Array<{key: number, value: number}>} arr - Array of status key-value pairs
 * @returns {Array<{key: number, value: number, percentage: string}>} Array with percentage field added
 */
export const getPercentage = (arr = []) => {
  const total = getTotal(arr);
  return arr.map((item) => ({
    key: item.key,
    value: item.value,
    percentage: `${((item.value / total) * 100).toFixed(0)}%`
  }));
};
