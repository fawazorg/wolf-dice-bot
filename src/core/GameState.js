/**
 * Game state constants
 *
 * Represents all possible states a game can be in during its lifecycle.
 * States flow sequentially: JOINING → GUESSING → PICKING → BETTING → ROLLING → FINISHED
 *
 * @readonly
 * @enum {string}
 */
export const GameState = {
  /** Players can join the game (initial state) */
  JOINING: "joining",

  /** Players submit guesses (1-50) */
  GUESSING: "guessing",

  /** Round winner selects opponent */
  PICKING: "picking",

  /** Round winner selects bet amount */
  BETTING: "betting",

  /** Players roll dice (PVP) */
  ROLLING: "rolling",

  /** Game completed, winner determined */
  FINISHED: "finished"
};

/**
 * Check if a state is valid
 * @param {string} state
 * @returns {boolean}
 */
export function isValidState(state) {
  return Object.values(GameState).includes(state);
}

/**
 * Get the next state in the game flow
 * @param {string} currentState
 * @returns {string|null} Next state or null if FINISHED
 */
export function getNextState(currentState) {
  const flow = [
    GameState.JOINING,
    GameState.GUESSING,
    GameState.PICKING,
    GameState.BETTING,
    GameState.ROLLING,
    GameState.FINISHED
  ];

  const index = flow.indexOf(currentState);
  if (index === -1 || index === flow.length - 1) {
    return null;
  }
  return flow[index + 1];
}
