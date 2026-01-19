/**
 * Player entity representing a participant in the dice game
 */
class Player {
  /** @type {number} WOLF subscriber ID */
  #id;

  /** @type {number} Current balance (500-5000) */
  #balance;

  /** @type {number|null} Current round guess (1-50) */
  #currentGuess;

  /**
   * @param {number} id - WOLF subscriber ID
   * @param {number} initialBalance - Starting balance (default 500)
   */
  constructor(id, initialBalance = 500) {
    this.#id = id;
    this.#balance = initialBalance;
    this.#currentGuess = null;
  }

  /** @returns {number} */
  get id() {
    return this.#id;
  }

  /** @returns {number} */
  get balance() {
    return this.#balance;
  }

  /** @returns {number|null} */
  get currentGuess() {
    return this.#currentGuess;
  }

  /**
   * Set player's guess for current round
   * @param {number} guess - Guess value (1-50)
   */
  setGuess(guess) {
    this.#currentGuess = guess;
  }

  /**
   * Clear player's guess
   */
  clearGuess() {
    this.#currentGuess = null;
  }

  /**
   * Deduct amount from balance
   * @param {number} amount - Amount to deduct
   * @returns {boolean} True if player is eliminated (balance <= 0)
   */
  deductBalance(amount) {
    this.#balance -= amount;
    return this.#balance <= 0;
  }

  /**
   * Add bonus to balance
   * @param {number} amount - Amount to add
   */
  addBonus(amount) {
    this.#balance += amount;
  }

  /**
   * Check if player can afford a bet
   * @param {number} amount - Bet amount
   * @returns {boolean}
   */
  canAffordBet(amount) {
    return this.#balance >= amount;
  }

  /**
   * Check if player is still active (has balance)
   * @returns {boolean}
   */
  isActive() {
    return this.#balance > 0;
  }

  /**
   * Check if player has minimum required balance to continue
   * @param {number} minBalance - Minimum balance (default 500)
   * @returns {boolean}
   */
  hasMinimumBalance(minBalance = 500) {
    return this.#balance >= minBalance;
  }
}

export default Player;
