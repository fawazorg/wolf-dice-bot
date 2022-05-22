const Default = require("./default");
const Help = require("./help");
const Refresh = require("./refresh");
const join = require("./join");

const commands = [join, Help, Refresh];

Default.children = commands;

module.exports = Default;
