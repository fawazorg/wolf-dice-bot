/**
 * @fileoverview Channel database model.
 * Defines the Mongoose schema and model for tracking bot channel membership and activity.
 * @module database/models/channel
 */

import { Schema, model } from 'mongoose';

/**
 * Mongoose schema for channel activity tracking.
 * @typedef {Object} ChannelDocument
 * @property {number} channelId - Unique channel ID from WOLF platform
 * @property {Date} lastActiveAt - Timestamp of last activity in this channel
 */

/**
 * Channel schema definition.
 * Used to track which channels the bot is in and when they were last active.
 * Inactive channels can be identified and left to reduce bot resource usage.
 * @type {Schema<ChannelDocument>}
 */
const ChannelSchema = new Schema({
  channelId: { type: Number, unique: true, required: true },
  lastActiveAt: { type: Date, default: Date.now }
});

/**
 * Channel model for database operations.
 * @type {import('mongoose').Model<ChannelDocument>}
 */
export default model('Channel', ChannelSchema);
