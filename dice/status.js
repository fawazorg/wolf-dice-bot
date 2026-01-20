import Player from "../src/models/player.js";

const getTotal = (arr = []) => arr.reduce((prev, num) => prev + num.value, 0);
const getByKey = (arr = [], key) => arr.find((item) => item.key === key)?.percentage || "0%";
const getPercentage = (arr = []) => {
  const total = getTotal(arr);
  const percentage = arr.reduce((prev, item) => {
    item.percentage = `${((item.value / total) * 100).toFixed(0)}%`;

    return [...prev, item];
  }, []);

  return percentage;
};
/**
 *
 * @param {import("wolf.js").Command} command
 * @param {import("wolf.js").WOLF} api
 */
const status = async (api, command) => {
  const player = await Player.findOne({ id: command.sourceSubscriberId });
  if (!player || player.status.length <= 0) {
    const phrase = api.phrase.getByCommandAndName(command, "dice_message_status_empty");

    return command.reply(phrase);
  }

  const percentage = getPercentage(player.status);
  const phrase = api.phrase.getByCommandAndName(command, "dice_message_status");
  const text = api.utility.string.replace(phrase, {
    d1: getByKey(percentage, 1),
    d2: getByKey(percentage, 2),
    d3: getByKey(percentage, 3),
    d4: getByKey(percentage, 4),
    d5: getByKey(percentage, 5),
    d6: getByKey(percentage, 6)
  });

  return command.reply(text);
};

export { status };
