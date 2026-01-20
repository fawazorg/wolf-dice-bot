import { admins } from "../../../dice/data.js";
/**
 * update command
 * @param {import('wolf.js').WOLF} client
 * @param {import('wolf.js').CommandContext} command
 * @returns {Promise<Response<MessageResponse>>}
 */
export default async (client, command) => {
  const isDeveloper = command.sourceSubscriberId === client.config.get("developerId");
  const isAdmin = admins.includes(command.sourceSubscriberId);
  const okay = isDeveloper || isAdmin;
  if (!okay) {
    return command.reply(
      client.phrase.getByCommandAndName(command, "dice_admin_not_authorized_message")
    );
  }
  const status = command.argument;
  // TODO: handle errors
  await client.currentSubscriber.update({ status });

  const phrase = client.phrase.getByCommandAndName(command, "dice_admin_update_message");
  const content = client.utility.string.replace(phrase, { status });

  return command.reply(content);
};
