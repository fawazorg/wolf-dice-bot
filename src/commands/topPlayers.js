import { getTopPlayers } from "../dice/score.js";
/**
 * rank command
 * @param {import('wolf.js').WOLF} client
 * @param {import('wolf.js').CommandContext} command
 * @returns {Promise<Response<MessageResponse>>}
 */
export default async (client, command) => {
  const data = await getTopPlayers();
  if (data.length > 0) {
    let r = "";
    for (let index = 0; index < data.length; index++) {
      const user = data[index];
      const sub = await client.subscriber.getById(user.id);
      if (index === data.length - 1) {
        r += `${index + 1} ـ ${(client, sub.nickname)} ( ${sub.id} ) ـ  ${user.score}`;
      } else {
        r += `${index + 1} ـ ${(client, sub.nickname)} ( ${sub.id} ) ـ  ${user.score}\n`;
      }
    }
    return command.reply(
      client.utility.string.replace(
        client.phrase.getByCommandAndName(command, "dice_message_top_score"),
        {
          list: r
        }
      )
    );
  }
  return command.reply(client.phrase.getByCommandAndName(command, "dice_message_top_no_score"));
};
