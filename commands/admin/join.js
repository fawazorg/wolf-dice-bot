import { Validator } from "wolf.js";
import { AdminGroup, admins } from "../../dice/data.js";
import Group from "../../models/group.js";
/**
 * join command
 * @param {import('wolf.js').WOLF} client
 * @param {import('wolf.js').CommandContext} command
 * @returns {Promise<Response<MessageResponse>>}
 */
export default async (client, command) => {
  const isDeveloper = command.sourceSubscriberId === client.config.get("developerId");
  const isAdmin = admins.includes(command.sourceSubscriberId);
  const okay = isDeveloper || isAdmin;
  if (!okay || !Validator.isValidNumber(command.argument)) {
    return Promise.resolve();
  }

  const phrase = client.phrase().getByCommandAndName(command, "dice_message_admin_join");
  // group exist in db by anther bot
  const channleData = await Group.findOne({ gid: parseInt(command.argument) });

  if (channleData) {
    const err = phrase[8];

    return command.reply(err.msg);
  }

  // join response
  const res = await client.channel().joinById(parseInt(command.argument));
  const text = phrase.find((err) => err.code === res.code && err?.subCode === res.headers?.subCode);

  await command.reply(text.msg);
  // log message
  if (res.code === 200) {
    const logPhrase = client.phrase().getByCommandAndName(command, "dice_admin_join_log");
    const userAdmin = await client.subscriber().getById(command.sourceSubscriberId);
    const channel = await client.channel().getById(parseInt(command.argument));
    const content = client.utility().string().replace(logPhrase, {
      adminNickname: userAdmin.nickname,
      adminID: userAdmin.id,
      groupName: channel.name,
      groupID: channel.id
    });
    return client.messaging().sendGroupMessage(AdminGroup, content);
  }
};
