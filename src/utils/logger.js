/**
 * @fileoverview Logging utility using Winston.
 * Provides structured logging for application events.
 * @module utils/logger
 */

import winston from "winston";

/**
 * Winston logger instance configured for console output.
 * Logs to console with colorized output and timestamp.
 */
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let metaString = "";
      if (Object.keys(meta).length > 0) {
        metaString = ` ${JSON.stringify(meta)}`;
      }
      return `[${timestamp}] ${level}: ${message}${metaString}`;
    })
  ),
  transports: [new winston.transports.Console()]
});

export default logger;
