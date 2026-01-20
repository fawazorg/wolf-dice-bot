/**
 * Random number generation utilities
 * Platform-agnostic, pure functions for testing
 */
class Random {
  /**
   * Generate random integer in range [min, max] inclusive
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number}
   */
  static int(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Roll a die with given number of sides
   * @param {number} sides - Number of sides (e.g., 6 for d6)
   * @returns {number} 1 to sides
   */
  static roll(sides) {
    return Random.int(1, sides);
  }

  /**
   * Shuffle an array randomly
   * @param {Array} array - Array to shuffle
   * @returns {Array} New shuffled array
   */
  static shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Random.int(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Pick a random element from an array
   * @param {Array} array - Array to pick from
   * @returns {*} Random element or undefined if empty
   */
  static pick(array) {
    if (array.length === 0) return undefined;
    return array[Random.int(0, array.length - 1)];
  }
}

export default Random;
