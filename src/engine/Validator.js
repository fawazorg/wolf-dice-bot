/**
 * Platform-agnostic input validation for the dice game
 * All validation rules centralized without external dependencies
 */
class Validator {
  /** @type {number} Minimum balance amount */
  static #MIN_BALANCE = 500;

  /** @type {number} Maximum balance amount */
  static #MAX_BALANCE = 5000;

  /** @type {number} Balance increment (must be multiple of) */
  static #BALANCE_INCREMENT = 500;

  /** @type {number} Minimum guess value */
  static #MIN_GUESS = 1;

  /** @type {number} Maximum guess value */
  static #MAX_GUESS = 50;

  /** @type {number} Maximum players per game */
  static #MAX_PLAYERS = 16;

  /** @type {number} Minimum PVP roll */
  static #MIN_PVP_ROLL = 1;

  /** @type {number} Maximum PVP roll */
  static #MAX_PVP_ROLL = 6;

  /**
   * Validate starting balance for game creation
   * @param {number} balance - Balance to validate
   * @returns {{valid: boolean, error?: string}}
   */
  static validateBalance(balance) {
    if (typeof balance !== "number" || isNaN(balance)) {
      return { valid: false, error: "invalid_balance_type" };
    }

    if (balance <= 0) {
      return { valid: false, error: "balance_must_be_positive" };
    }

    if (balance > Validator.#MAX_BALANCE) {
      return { valid: false, error: "balance_exceeds_maximum" };
    }

    if (balance % Validator.#BALANCE_INCREMENT !== 0) {
      return { valid: false, error: "invalid_balance_increment" };
    }

    return { valid: true };
  }

  /**
   * Validate a player's guess
   * @param {number} guess - Guess to validate
   * @returns {{valid: boolean, error?: string}}
   */
  static validateGuess(guess) {
    if (typeof guess !== "number" || isNaN(guess)) {
      return { valid: false, error: "invalid_guess_type" };
    }

    if (!Number.isInteger(guess)) {
      return { valid: false, error: "guess_must_be_integer" };
    }

    if (guess < Validator.#MIN_GUESS || guess > Validator.#MAX_GUESS) {
      return { valid: false, error: "guess_out_of_range" };
    }

    return { valid: true };
  }

  /**
   * Validate a bet amount
   * @param {number} bet - Bet amount to validate
   * @param {number} playerBalance - Player's current balance
   * @returns {{valid: boolean, error?: string}}
   */
  static validateBet(bet, playerBalance) {
    if (typeof bet !== "number" || isNaN(bet)) {
      return { valid: false, error: "invalid_bet_type" };
    }

    if (!Number.isInteger(bet)) {
      return { valid: false, error: "bet_must_be_integer" };
    }

    if (bet <= 0) {
      return { valid: false, error: "bet_must_be_positive" };
    }

    if (bet % Validator.#BALANCE_INCREMENT !== 0) {
      return { valid: false, error: "invalid_bet_increment" };
    }

    if (bet > playerBalance) {
      return { valid: false, error: "insufficient_balance" };
    }

    return { valid: true };
  }

  /**
   * Validate opponent pick
   * @param {number} pickIndex - Picked index (1-based from user input)
   * @param {number} totalPlayers - Total eligible players
   * @param {number} pickerIndex - Picker's own index (0-based)
   * @returns {{valid: boolean, error?: string, normalizedIndex?: number}}
   */
  static validatePick(pickIndex, totalPlayers, pickerIndex) {
    if (typeof pickIndex !== "number" || isNaN(pickIndex)) {
      return { valid: false, error: "invalid_pick_type" };
    }

    if (!Number.isInteger(pickIndex)) {
      return { valid: false, error: "pick_must_be_integer" };
    }

    // Convert from 1-based to 0-based
    const normalizedIndex = pickIndex - 1;

    if (normalizedIndex < 0 || normalizedIndex >= totalPlayers) {
      return { valid: false, error: "pick_out_of_range" };
    }

    // Can't pick yourself
    if (normalizedIndex === pickerIndex) {
      return { valid: false, error: "cannot_pick_self" };
    }

    return { valid: true, normalizedIndex };
  }

  /**
   * Validate PVP dice roll
   * @param {number} roll - Roll value to validate
   * @returns {{valid: boolean, error?: string}}
   */
  static validatePVPRoll(roll) {
    if (typeof roll !== "number" || isNaN(roll)) {
      return { valid: false, error: "invalid_roll_type" };
    }

    if (!Number.isInteger(roll)) {
      return { valid: false, error: "roll_must_be_integer" };
    }

    if (roll < Validator.#MIN_PVP_ROLL || roll > Validator.#MAX_PVP_ROLL) {
      return { valid: false, error: "roll_out_of_range" };
    }

    return { valid: true };
  }

  /**
   * Validate player count for game creation
   * @param {number} count - Player count to validate
   * @returns {{valid: boolean, error?: string}}
   */
  static validatePlayerCount(count) {
    if (typeof count !== "number" || isNaN(count)) {
      return { valid: false, error: "invalid_count_type" };
    }

    if (count < 1) {
      return { valid: false, error: "insufficient_players" };
    }

    if (count > Validator.#MAX_PLAYERS) {
      return { valid: false, error: "maximum_players_exceeded" };
    }

    return { valid: true };
  }

  // Getters for constants

  /** @returns {number} Minimum balance */
  static get MIN_BALANCE() {
    return Validator.#MIN_BALANCE;
  }

  /** @returns {number} Maximum balance */
  static get MAX_BALANCE() {
    return Validator.#MAX_BALANCE;
  }

  /** @returns {number} Balance increment */
  static get BALANCE_INCREMENT() {
    return Validator.#BALANCE_INCREMENT;
  }

  /** @returns {number} Minimum guess */
  static get MIN_GUESS() {
    return Validator.#MIN_GUESS;
  }

  /** @returns {number} Maximum guess */
  static get MAX_GUESS() {
    return Validator.#MAX_GUESS;
  }

  /** @returns {number} Maximum players */
  static get MAX_PLAYERS() {
    return Validator.#MAX_PLAYERS;
  }
}

export default Validator;
