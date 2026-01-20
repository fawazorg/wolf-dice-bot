/**
 * @fileoverview MongoDB database connection configuration.
 * Establishes connection to MongoDB using Mongoose ODM with credentials from environment variables.
 * @module database/connection
 */

import mongoose from "mongoose";

// Disable strict query mode for more flexible queries
mongoose.set({ strictQuery: false });

/**
 * Connect to MongoDB instance.
 * Connection parameters are read from environment variables:
 * - MONGO_DB_NAME: Database name
 * - MONGO_USER: Database user
 * - MONGO_PWD: Database password
 */
mongoose.connect(`mongodb://127.0.0.1:27018/${process.env.MONGO_DB_NAME}`, {
  user: process.env.MONGO_USER,
  pass: process.env.MONGO_PWD,
});

// Use native ES6 promises
mongoose.Promise = global.Promise;

/**
 * Database connection instance.
 * @type {import('mongoose').Connection}
 */
const db = mongoose.connection;

// Set up connection event handlers
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
  console.log("[*] Database is a live!");
});
