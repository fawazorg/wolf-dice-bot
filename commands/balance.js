/**
 * balance command
 * @param {import('wolf.js').CommandContext} command
 * @param {import('../dice/game.js').default} game
 * @returns {Promise<Response<MessageResponse>>}
 */
export default async (command, game) => {
  await game.balance(command);
};
