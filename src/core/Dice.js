import Random from '../utils/Random.js';

/**
 * Dice rolling and guess matching logic
 */
class Dice {
  /** Maximum value for guess roll (1-50) */
  static MAX_GUESS_ROLL = 50;

  /** Maximum value for PVP roll (1-6) */
  static MAX_PVP_ROLL = 6;

  /** Bonus for exact guess match */
  static EXACT_BONUS = 500;

  /** Points for exact guess */
  static EXACT_POINTS = 2;

  /**
   * Roll for guessing phase (1-50)
   * @returns {number}
   */
  static rollGuess() {
    return Random.roll(Dice.MAX_GUESS_ROLL);
  }

  /**
   * Roll for PVP phase (1-6)
   * @returns {number}
   */
  static rollPVP() {
    return Random.roll(Dice.MAX_PVP_ROLL);
  }

  /**
   * Find player with closest guess to target
   * @param {import('./Player.js').default[]} players - Players with guesses
   * @param {number} targetNumber - The rolled number
   * @returns {import('./Player.js').default|null} Closest player or null
   */
  static findClosestGuess(players, targetNumber) {
    const playersWithGuesses = players.filter(p => p.currentGuess !== null);

    if (playersWithGuesses.length === 0) {
      return null;
    }

    // Sort by distance to target (ascending), then by guess value (ascending) for ties
    playersWithGuesses.sort((a, b) => {
      const distA = Math.abs(a.currentGuess - targetNumber);
      const distB = Math.abs(b.currentGuess - targetNumber);
      if (distA !== distB) {
        return distA - distB;
      }
      return a.currentGuess - b.currentGuess;
    });

    return playersWithGuesses[0];
  }

  /**
   * Check if guess exactly matches roll
   * @param {number} guess - Player's guess
   * @param {number} roll - Rolled number
   * @returns {boolean}
   */
  static isExactMatch(guess, roll) {
    return guess === roll;
  }

  /**
   * Compare two PVP rolls
   * @param {number} roll1 - First player's roll
   * @param {number} roll2 - Second player's roll
   * @returns {number} 1 if roll1 wins, -1 if roll2 wins, 0 if tie
   */
  static compareRolls(roll1, roll2) {
    if (roll1 > roll2) return 1;
    if (roll2 > roll1) return -1;
    return 0;
  }
}

export default Dice;
