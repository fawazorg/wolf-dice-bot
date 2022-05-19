const group = require("../dice/data");
/**
 *
 * @param {import('wolf.js').WOLFBot} api
 * @param {object} g
 * @param {import('../dice/game')} game
 */
const UpdateTimer = async (api, { gid }, game) => {
  if (!group.has(gid)) {
    return;
  }
  let tempGroup = group.get(gid);
  if (tempGroup.players.size <= 1) {
    return await game.finish(tempGroup);
  } else {
    if (!tempGroup.start) {
      return await game.start(tempGroup.id);
    }
  }
};

module.exports = { UpdateTimer };
