/**
 * @fileoverview MongoDB database connection configuration.
 * Establishes connection to MongoDB using Mongoose ODM with credentials from environment variables.
 * @module storage/mongo/connection
 */

import mongoose from "mongoose";
import logger from "../../utils/logger.js";

// Disable strict query mode for more flexible queries
mongoose.set({ strictQuery: false });

/**
 * Connect to MongoDB instance.
 * Connection parameters are read from environment variables:
 * - MONGO_DB_NAME: Database name
 * - MONGO_USER: Database user
 * - MONGO_PWD: Database password
 * - MONGO_HOST_PORT: MongoDB port (defaults to 27017)
 */
mongoose.connect(
  `mongodb://127.0.0.1:${process.env.MONGO_HOST_PORT || 27017}/${process.env.MONGO_DB_NAME}`,
  {
    user: process.env.MONGO_USER,
    pass: process.env.MONGO_PWD,
    maxPoolSize: 5,
    minPoolSize: 1
  }
);

// Use native ES6 promises
mongoose.Promise = global.Promise;

/**
 * Database connection instance.
 * @type {import('mongoose').Connection}
 */
const db = mongoose.connection;

// Set up connection event handlers
db.on("error", (error) => {
  logger.error("Database connection error", { error: error.message });
});

db.once("open", () => {
  logger.info("Database connected successfully", {
    database: process.env.MONGO_DB_NAME,
    host: `127.0.0.1:${process.env.MONGO_HOST_PORT || 27017}`
  });
});
