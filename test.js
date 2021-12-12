const Groups = new Map();

Groups.set(1, { join: false, max: 10, players: new Map() });
Groups.set(2, { join: true, max: 20, players: new Map() });
Groups.get(1).players.set(12, { b: 2500, g: 12 });
Groups.get(1).players.set(13, { b: 2500, g: 12 });
Groups.get(2).players.set(14, { b: 2500, g: 12 });
Groups.get(2).players.set(15, { b: 2500, g: 12 });
update(1, "join", true);
console.log(Groups.has(1222));

function update(id, key, valus) {
  let g = Groups.get(id);
  if (g.hasOwnProperty(key)) {
    g[key] = valus;
    Groups.set(id, g);
  }
}
