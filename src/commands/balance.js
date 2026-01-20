/**
 * balance command
 * @param {import('wolf.js').CommandContext} command
 * @param {import('../src/managers/GameManager.js').default} game
 * @returns {Promise<void>}
 */
export default async (command, game) => {
  await game.balance(command);
};
