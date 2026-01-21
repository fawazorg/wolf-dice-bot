/**
 * @fileoverview User-facing command handlers module.
 * Exports all dice game commands for player interactions and admin operations.
 * @module commands
 */

import * as admin from "./admin/index.js";
import * as game from "./game/index.js";
import * as info from "./info/index.js";
import * as main from "./main/index.js";
import * as player from "./player/index.js";

export { admin, game, info, main, player };

// Re-export individual commands for backward compatibility
export const { cancel, create, join, show } = game;
export const { help } = info;
export const { main: mainCommand } = main;
export const { balance, rank, status, top } = player;
