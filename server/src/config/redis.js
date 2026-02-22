/**
 * ──────────────────────────────────────────────────────────
 * Redis Client — Optional Caching & Rate-Limit Store
 * ──────────────────────────────────────────────────────────
 * Provides a lazy-initialized Redis connection.
 * If REDIS_URL is not configured, the client is still created
 * but callers should check `isReady()` before use.
 *
 * Graceful degradation: the app runs without Redis — rate
 * limiting falls back to in-memory and caching is skipped.
 * ──────────────────────────────────────────────────────────
 */
const Redis = require('ioredis');
const config = require('./index');
const logger = require('../utils/logger');

let redis = null;
let connected = false;

/**
 * Returns the shared Redis client instance (lazy singleton).
 * Connection is established on first call.
 */
function getRedis() {
  if (redis) return redis;

  if (!config.redisUrl) {
    logger.info('Redis: REDIS_URL not set — running without cache');
    // Return a stub that silently no-ops so callers don't crash
    redis = createStub();
    return redis;
  }

  redis = new Redis(config.redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 10) {
        logger.warn('Redis: max reconnection attempts reached');
        return null; // stop retrying
      }
      return Math.min(times * 200, 2000);
    },
    lazyConnect: false,
    enableReadyCheck: true,
  });

  redis.on('connect', () => {
    connected = true;
    logger.info('Redis: connected');
  });

  redis.on('ready', () => {
    connected = true;
    logger.info('Redis: ready');
  });

  redis.on('error', (err) => {
    connected = false;
    logger.warn(`Redis: error — ${err.message}`);
  });

  redis.on('close', () => {
    connected = false;
    logger.info('Redis: disconnected');
  });

  return redis;
}

/** Whether the Redis client is connected and usable. */
function isReady() {
  return connected && redis && !(redis._stub);
}

/**
 * Graceful disconnect for shutdown hooks.
 */
async function disconnectRedis() {
  if (redis && !redis._stub) {
    await redis.quit().catch(() => {});
    logger.info('Redis: disconnected (shutdown)');
  }
}

/**
 * Creates a no-op stub with the same interface so callers
 * don't need null checks everywhere.
 */
function createStub() {
  const noop = () => Promise.resolve(null);
  return {
    _stub: true,
    get: noop,
    set: noop,
    setex: noop,
    del: noop,
    keys: () => Promise.resolve([]),
    ping: () => Promise.resolve('PONG'),
    call: noop,
    quit: noop,
    status: 'stub',
  };
}

module.exports = { getRedis, isReady, disconnectRedis };
