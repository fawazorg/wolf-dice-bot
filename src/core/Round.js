/**
 * Round entity representing a single round in the dice game
 * Encapsulates all round-specific state: guesses, picks, bets, and rolls
 */
class Round {
  /** @type {number} Round number (1-indexed) */
  #number;

  /** @type {Map<number, number>} Player guesses (playerId → guess 1-50) */
  #guesses;

  /** @type {number|null} The target number rolled for guessing phase */
  #targetNumber;

  /** @type {import('./Player.js').default|null} Player with closest guess */
  #candidate;

  /** @type {import('./Player.js').default|null} Opponent picked by candidate */
  #opponent;

  /** @type {number} Bet amount for this round */
  #bet;

  /** @type {number|null} Candidate's dice roll */
  #candidateRoll;

  /** @type {number|null} Opponent's dice roll */
  #opponentRoll;

  /** @type {boolean} Whether candidate got exact guess */
  #isExactMatch;

  /**
   * @param {number} number - Round number
   */
  constructor(number = 1) {
    this.#number = number;
    this.#guesses = new Map();
    this.#targetNumber = null;
    this.#candidate = null;
    this.#opponent = null;
    this.#bet = 0;
    this.#candidateRoll = null;
    this.#opponentRoll = null;
    this.#isExactMatch = false;
  }

  /** @returns {number} */
  get number() {
    return this.#number;
  }

  /** @returns {Map<number, number>} Player guesses */
  get guesses() {
    return this.#guesses;
  }

  /** @returns {number|null} Target number rolled */
  get targetNumber() {
    return this.#targetNumber;
  }

  /** @returns {import('./Player.js').default|null} Candidate player */
  get candidate() {
    return this.#candidate;
  }

  /** @returns {import('./Player.js').default|null} Opponent player */
  get opponent() {
    return this.#opponent;
  }

  /** @returns {number} Bet amount */
  get bet() {
    return this.#bet;
  }

  /** @returns {number|null} Candidate's roll */
  get candidateRoll() {
    return this.#candidateRoll;
  }

  /** @returns {number|null} Opponent's roll */
  get opponentRoll() {
    return this.#opponentRoll;
  }

  /** @returns {boolean} Whether exact guess occurred */
  get isExactMatch() {
    return this.#isExactMatch;
  }

  /** @returns {boolean} Whether round has a target number */
  hasTargetNumber() {
    return this.#targetNumber !== null;
  }

  /** @returns {boolean} Whether round has a candidate */
  hasCandidate() {
    return this.#candidate !== null;
  }

  /** @returns {boolean} Whether round has an opponent selected */
  hasOpponent() {
    return this.#opponent !== null;
  }

  /** @returns {boolean} Whether bet has been placed */
  hasBet() {
    return this.#bet > 0;
  }

  /** @returns {boolean} Whether both players have rolled */
  hasBothRolls() {
    return this.#candidateRoll !== null && this.#opponentRoll !== null;
  }

  /** @returns {number} Number of guesses submitted */
  getGuessCount() {
    return this.#guesses.size;
  }

  /**
   * Record a player's guess
   * @param {number} playerId - Player ID
   * @param {number} guess - Guess value (1-50)
   */
  recordGuess(playerId, guess) {
    this.#guesses.set(playerId, guess);
  }

  /**
   * Get a player's guess
   * @param {number} playerId - Player ID
   * @returns {number|undefined} The guess or undefined if not found
   */
  getGuess(playerId) {
    return this.#guesses.get(playerId);
  }

  /**
   * Get all guesses as array
   * @returns {Array<{playerId: number, guess: number}>}
   */
  getAllGuesses() {
    return [...this.#guesses.entries()].map(([playerId, guess]) => ({ playerId, guess }));
  }

  /**
   * Clear all guesses
   */
  clearGuesses() {
    this.#guesses.clear();
  }

  /**
   * Set the target number for this round
   * @param {number} target - Target number (1-50)
   */
  setTargetNumber(target) {
    this.#targetNumber = target;
  }

  /**
   * Set the candidate (winner of guessing phase)
   * @param {import('./Player.js').default} player - Candidate player
   * @param {boolean} isExact - Whether guess was exact
   */
  setCandidate(player, isExact = false) {
    this.#candidate = player;
    this.#isExactMatch = isExact;
  }

  /**
   * Set the opponent for PVP
   * @param {import('./Player.js').default} player - Opponent player
   */
  setOpponent(player) {
    this.#opponent = player;
  }

  /**
   * Set the bet amount
   * @param {number} amount - Bet amount (must be multiple of 500)
   */
  setBet(amount) {
    this.#bet = amount;
  }

  /**
   * Record candidate's dice roll
   * @param {number} roll - Roll value (1-6)
   */
  setCandidateRoll(roll) {
    this.#candidateRoll = roll;
  }

  /**
   * Record opponent's dice roll
   * @param {number} roll - Roll value (1-6)
   */
  setOpponentRoll(roll) {
    this.#opponentRoll = roll;
  }

  /**
   * Clear dice rolls (for ties that need re-roll)
   */
  clearRolls() {
    this.#candidateRoll = null;
    this.#opponentRoll = null;
  }

  /**
   * Determine PVP result based on rolls
   * @returns {{winner: 'candidate'|'opponent', loser: 'candidate'|'opponent', isTie: boolean}}
   */
  getPVPResult() {
    if (!this.hasBothRolls()) {
      return { winner: null, loser: null, isTie: false };
    }

    if (this.#candidateRoll > this.#opponentRoll) {
      return { winner: "candidate", loser: "opponent", isTie: false };
    }

    if (this.#opponentRoll > this.#candidateRoll) {
      return { winner: "opponent", loser: "candidate", isTie: false };
    }

    return { winner: null, loser: null, isTie: true };
  }

  /**
   * Reset round for next iteration (keeps round number, clears state)
   */
  reset() {
    this.#guesses.clear();
    this.#targetNumber = null;
    this.#candidate = null;
    this.#opponent = null;
    this.#bet = 0;
    this.#candidateRoll = null;
    this.#opponentRoll = null;
    this.#isExactMatch = false;
  }

  /**
   * Create a snapshot of round state for logging/debugging
   * @returns {Object}
   */
  toJSON() {
    return {
      number: this.#number,
      targetNumber: this.#targetNumber,
      candidateId: this.#candidate?.id,
      opponentId: this.#opponent?.id,
      bet: this.#bet,
      candidateRoll: this.#candidateRoll,
      opponentRoll: this.#opponentRoll,
      isExactMatch: this.#isExactMatch,
      guessCount: this.#guesses.size
    };
  }
}

export default Round;
