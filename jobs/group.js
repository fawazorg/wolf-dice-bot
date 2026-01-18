import { group } from "../dice/data.js";
/**
 *
 * @param {import('wolf.js').WOLF} api
 * @param {object} g
 * @param {import('../dice/game')} game
 */
export default async function UpdateTimer(api, { gid }, game) {
  if (!group.has(gid)) {
    return;
  }

  const tempGroup = group.get(gid);

  if (tempGroup.players.size <= 1) {
    return game.finish(tempGroup);
  } else {
    if (!tempGroup.start) {
      return game.start(tempGroup.id);
    }
  }
};
