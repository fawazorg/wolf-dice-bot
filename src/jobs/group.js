/**
 *
 * @param {import('wolf.js').WOLFBot} api
 * @param {object} g
 * @param {import('../dice/game')} game
 */
const UpdateTimer = async (api, data, game) => {
  let g = game.find(data.id);
  if (g.players.length <= 1) {
    await game.finish(g);
    return;
  }
  if (g.joinable) {
    await game.start(g);
  }
};

module.exports = { UpdateTimer };
