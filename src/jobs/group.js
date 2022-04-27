/**
 *
 * @param {import('wolf.js').WOLFBot} api
 * @param {object} g
 * @param {import('../dice/game')} game
 */
const UpdateTimer = async (api, data, game) => {
  let g = game.find(data.id);
  if (g) {
    if (g.players.length <= 1) {
      return await game.finish(g);
    } else {
      if (g.joinable) {
        return await game.start(g);
      }
      return;
    }
  }
  return;
};

module.exports = { UpdateTimer };
