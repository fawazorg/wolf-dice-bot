import { refreshUnsetGroup } from "../../../dice/active.js";
import { admins } from "../../../dice/data.js";
/**
 * refresh command
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
  const names = await refreshUnsetGroup(client);
  const phrase = client.phrase.getByCommandAndName(command, "dice_admin_refresh_message");
  const content = client.utility.string.replace(phrase, { list: names.join("\n") });

  return command.reply(content);
};
