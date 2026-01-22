/**
 * @fileoverview Group database model.
 * Defines the Mongoose schema and model for tracking bot group membership and activity.
 * @module database/models/group
 */

import { Schema, model } from "mongoose";

/**
 * Mongoose schema for group activity tracking.
 * @typedef {Object} GroupDocument
 * @property {number} gid - Unique group/channel ID from WOLF platform
 * @property {Date} lastActiveAt - Timestamp of last activity in this group
 */

/**
 * Group schema definition.
 * Used to track which groups the bot is in and when they were last active.
 * Inactive groups can be identified and left to reduce bot resource usage.
 * @type {Schema<GroupDocument>}
 */
const GroupSchema = new Schema({
  gid: { type: Number, unique: true, required: true },
  lastActiveAt: { type: Date, default: Date.now }
});

/**
 * Group model for database operations.
 * @type {import('mongoose').Model<GroupDocument>}
 */
export default model("Group", GroupSchema);
