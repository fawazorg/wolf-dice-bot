let groups = [
  {
    id: 1,
    status: 0,
    playersCount: 10,
    dice: 3,
    round: { player: { id: 1, dice: 2 }, against: { id: 2, dice: 3 } },
    players: [{ id: 1, balance: 500, currentGuess: null }],
  },
];

const add = (id, count) => {
  if (!find(id)) {
    groups.push({ id, status: 0, playersCount: count, players: [] });
    return find(id);
  }
  return false;
};

const find = (id) => {
  return groups.find((g) => g.id === id) ?? false;
};

const finish = (id) => {
  if (find(id)) {
    groups = groups.filter((g) => g.id !== id);
    return true;
  }
  return false;
};

const getPlayers = (id) => {
  let g = find(id);
  if (g) {
    return g.players.filter((p) => p.balance > 0);
  }
  return [];
};

const getPlayer = (id, player) => {
  let g = find(id);
  if (g && g.players.length > 0) {
    return g.players.filter((p) => p.id === player)[0];
  }
  return false;
};

const getPlayerBalance = (id, player) => {
  let g = find(id);
  if (g && g.players.length > 0) {
    return g.players.filter((p) => p.id === player)[0].balance;
  }
  return false;
};

const join = (command, player) => {
  let g = find(command.targetGroupId);
  if (getPlayer(command.targetGroupId, player.id) && !g.status) {
    return false;
  }
  if (g.players.length <= g.playersCount) {
    let p = {};
    p.id = player.id;
    p.nickname = player.nickname;
    p.balance = 500;
    g.players.push(p);
    if (g.players.length === g.playersCount) {
      start(id);
    }
    return player;
  }
  return false;
};
const printPlayer = () => {};
const start = (id) => {
  let g = find(id);
  if (getPlayers(g.id).length <= 0) {
    finish(g.id);
    console.log("game finish!");
    return;
  }
  console.log("game Strat");
};
module.exports = { add, find, join, start, finish };
