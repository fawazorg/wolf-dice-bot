/**
 * @fileoverview Redis connection manager for game state storage.
 * Provides singleton connection with reconnection handling and graceful shutdown.
 * @module storage/redis/connection
 */

import Redis from "ioredis";
import logger from "../../utils/logger.js";

/** @type {Redis|null} Singleton Redis instance */
let redis = null;

/** @type {boolean} Connection status */
let isConnected = false;

/**
 * Get or create Redis connection
 * @param {Object} options - Connection options
 * @param {string} [options.host='localhost'] - Redis host
 * @param {number} [options.port=6379] - Redis port
 * @param {string} [options.password] - Redis password (optional)
 * @param {number} [options.db=0] - Redis database number
 * @returns {Redis} Redis client instance
 */
export function getRedis(options = {}) {
  if (redis) {
    return redis;
  }

  const config = {
    host: options.host || process.env.REDIS_HOST || "localhost",
    port: options.port || parseInt(process.env.REDIS_HOST_PORT, 10) || 6379,
    password: options.password || process.env.REDIS_PASSWORD || undefined,
    db: options.db || 0,
    retryStrategy: (times) => {
      if (times > 10) {
        logger.error("Redis: Max reconnection attempts reached");
        return null;
      }
      const delay = Math.min(times * 100, 3000);
      logger.warn(`Redis: Reconnecting in ${delay}ms (attempt ${times})`);
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false
  };

  redis = new Redis(config);

  redis.on("connect", () => {
    logger.info("Redis: Connecting...");
  });

  redis.on("ready", () => {
    isConnected = true;
    logger.info("Redis: Connected successfully", {
      host: config.host,
      port: config.port
    });
  });

  redis.on("error", (err) => {
    logger.error("Redis: Connection error", { error: err.message });
  });

  redis.on("close", () => {
    isConnected = false;
    logger.warn("Redis: Connection closed");
  });

  redis.on("reconnecting", () => {
    logger.info("Redis: Reconnecting...");
  });

  return redis;
}

/**
 * Check if Redis is connected
 * @returns {boolean}
 */
export function isRedisConnected() {
  return isConnected && redis !== null;
}

/**
 * Close Redis connection gracefully
 * @returns {Promise<void>}
 */
export async function closeRedis() {
  if (redis) {
    logger.info("Redis: Closing connection...");
    await redis.quit();
    redis = null;
    isConnected = false;
    logger.info("Redis: Connection closed");
  }
}

/**
 * Disconnect Redis immediately (for emergency shutdown)
 */
export function disconnectRedis() {
  if (redis) {
    redis.disconnect();
    redis = null;
    isConnected = false;
  }
}

export default { getRedis, isRedisConnected, closeRedis, disconnectRedis };
