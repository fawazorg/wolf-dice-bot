/**
 * @fileoverview User-facing command handlers module.
 * Exports all dice game commands for player interactions and admin operations.
 * @module commands
 */

import * as admin from "./admin/index.js";
import * as game from "./game/index.js";
import * as info from "./info/index.js";
import main from "./main.js";

export { admin, game, info, main };
