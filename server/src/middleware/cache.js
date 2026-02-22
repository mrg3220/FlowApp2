/**
 * ──────────────────────────────────────────────────────────
 * Redis Cache Middleware
 * ──────────────────────────────────────────────────────────
 * Caches GET responses in Redis with configurable TTL.
 * Cache keys include the user ID so each user gets their
 * own cached view (important for role-based data).
 *
 * Graceful degradation: if Redis is unavailable, requests
 * pass through uncached with zero impact on functionality.
 * ──────────────────────────────────────────────────────────
 */
const { getRedis, isReady } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Returns Express middleware that caches the JSON response.
 *
 * @param {number} ttlSeconds - Cache lifetime in seconds (default 60)
 * @returns {import('express').RequestHandler}
 *
 * @example
 *   router.get('/classes', authenticate, cache(120), controller.list);
 */
function cache(ttlSeconds = 60) {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') return next();
    // Skip if Redis isn't available
    if (!isReady()) return next();

    const redis = getRedis();
    const key = `cache:${req.originalUrl}:${req.user?.id || 'anon'}`;

    try {
      const cached = await redis.get(key);
      if (cached) {
        res.set('X-Cache', 'HIT');
        return res.json(JSON.parse(cached));
      }
    } catch (err) {
      logger.debug(`Cache read error: ${err.message}`);
    }

    // Monkey-patch res.json to capture and cache the response
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Only cache successful responses
      if (res.statusCode < 400) {
        res.set('X-Cache', 'MISS');
        redis.setex(key, ttlSeconds, JSON.stringify(body)).catch(() => {});
      }
      return originalJson(body);
    };

    next();
  };
}

/**
 * Invalidates cached entries matching a glob pattern.
 * Call after write operations (POST/PUT/DELETE) to ensure
 * subsequent reads return fresh data.
 *
 * @param {string} pattern - Redis key glob (e.g., '/api/classes*')
 *
 * @example
 *   await invalidateCache('/api/classes*');
 */
async function invalidateCache(pattern) {
  if (!isReady()) return;
  try {
    const redis = getRedis();
    const keys = await redis.keys(`cache:${pattern}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.debug(`Cache invalidated: ${keys.length} keys matching ${pattern}`);
    }
  } catch {
    // Graceful degradation — stale cache is better than an error
  }
}

module.exports = { cache, invalidateCache };
