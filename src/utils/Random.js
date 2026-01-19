/**
 * Random number generation utilities
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
}

export default Random;
