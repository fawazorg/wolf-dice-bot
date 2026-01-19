import { getPlayerRankData } from "../dice/score.js";
/**
 * rank command
 * @param {import('wolf.js').WOLF} client
 * @param {import('wolf.js').CommandContext} command
 * @returns {Promise<Response<MessageResponse>>}
 */
export default async (client, command) => {
  const data = await getPlayerRankData(command.sourceSubscriberId);
  const user = await client.subscriber.getById(command.sourceSubscriberId);

  if (!data) {
    return command.reply(
      client.utility.string.replace(
        client.phrase.getByCommandAndName(command, "dice_message_no_score"),
        {
          nickname: user.nickname,
          id: user.id
        }
      )
    );
  }
  return command.reply(
    client.utility.string.replace(
      client.phrase.getByCommandAndName(command, "dice_message_score"),
      {
        rank: data.GlobalRank,
        total: data.score,
        nickname: user.nickname,
        id: user.id
      }
    )
  );
};
