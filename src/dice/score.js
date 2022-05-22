const Player = require("../model/player");

const addPoint = async (id, points) => {
  await Player.findOrCreate({ id }, async (err, data) => {
    if (err) {
      throw err;
    }
    if (data) {
      Player.findByIdAndUpdate(data._id, { $inc: { score: points } }, async (err, data) => {
        if (err) {
          throw err;
        }
        if (data) {
          return true;
        }
      });
    }
  });
};
const myRank = async (command, api) => {
  Player.aggregate(
    [
      {
        $setWindowFields: {
          sortBy: { score: -1 },
          output: {
            GlobalRank: {
              $documentNumber: {},
            },
          },
        },
      },
      { $match: { id: { $eq: command.sourceSubscriberId } } },
    ],
    async (err, [data]) => {
      if (err) {
        throw err;
      }
      if (data) {
        let user = await api.subscriber().getById(command.sourceSubscriberId);
        return await api.messaging().sendMessage(
          command,
          api
            .utility()
            .string()
            .replace(api.phrase().getByCommandAndName(command, "dice_message_score"), {
              rank: data.GlobalRank,
              total: data.score,
              nickname: user.nickname,
              id: user.id,
            })
        );
      } else {
        let user = await api.subscriber().getById(command.sourceSubscriberId);
        return await api.messaging().sendMessage(
          command,
          api
            .utility()
            .string()
            .replace(api.phrase().getByCommandAndName(command, "dice_message_no_score"), {
              nickname: user.nickname,
              id: user.id,
            })
        );
      }
    }
  );
};
const top10 = async (command, api) => {
  Player.find()
    .sort({ score: -1 })
    .limit(10)
    .exec(async (err, data) => {
      if (err) {
        throw err;
      }
      if (data) {
        let r = "";
        for (let index = 0; index < data.length; index++) {
          const user = data[index];
          const sub = await api.subscriber().getById(user.id);
          if (index === data.length - 1) {
            r += `${index + 1} ـ ${(api, sub.nickname)} ( ${sub.id} ) ـ  ${user.score}`;
          } else {
            r += `${index + 1} ـ ${(api, sub.nickname)} ( ${sub.id} ) ـ  ${user.score}\n`;
          }
        }
        return await api.messaging().sendMessage(
          command,
          api
            .utility()
            .string()
            .replace(api.phrase().getByCommandAndName(command, "dice_message_g_score"), {
              list: r,
            })
        );
      }
    });
};

module.exports = { addPoint, myRank, top10 };
