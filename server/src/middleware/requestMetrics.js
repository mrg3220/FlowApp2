/**
 * ──────────────────────────────────────────────────────────
 * In-Memory Request Metrics Collector
 * ──────────────────────────────────────────────────────────
 * Tracks request throughput, latency, error rates, and
 * per-endpoint breakdowns for the SRE dashboard.
 *
 * Metrics are kept in memory with a rolling 1-hour window
 * (buckets auto-expire). No external dependency needed.
 * ──────────────────────────────────────────────────────────
 */

const BUCKET_SIZE_MS = 60_000;       // 1-minute buckets
const MAX_BUCKETS    = 60;           // keep 60 minutes of history

/** @type {Map<number, { total: number, errors: number, byStatus: Record<string,number>, byRoute: Record<string,number>, latencySum: number, latencyCount: number, latencyMax: number }>} */
const buckets = new Map();

/** Aggregate counters since process start */
const lifetime = {
  totalRequests: 0,
  totalErrors: 0,
  latencySum: 0,
  latencyCount: 0,
};

function getBucketKey(ts) {
  return Math.floor(ts / BUCKET_SIZE_MS) * BUCKET_SIZE_MS;
}

function getOrCreateBucket(ts) {
  const key = getBucketKey(ts);
  if (!buckets.has(key)) {
    // Evict old buckets
    const cutoff = key - MAX_BUCKETS * BUCKET_SIZE_MS;
    for (const k of buckets.keys()) {
      if (k < cutoff) buckets.delete(k);
    }
    buckets.set(key, {
      total: 0,
      errors: 0,
      byStatus: {},
      byRoute: {},
      latencySum: 0,
      latencyCount: 0,
      latencyMax: 0,
    });
  }
  return buckets.get(key);
}

/**
 * Express middleware — attach to app before routes.
 */
function requestMetricsMiddleware(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const route = req.route ? `${req.method} ${req.baseUrl}${req.route.path}` : `${req.method} ${req.baseUrl || req.path}`;
    const isError = status >= 400;

    const bucket = getOrCreateBucket(start);
    bucket.total++;
    bucket.byStatus[status] = (bucket.byStatus[status] || 0) + 1;
    bucket.byRoute[route] = (bucket.byRoute[route] || 0) + 1;
    bucket.latencySum += duration;
    bucket.latencyCount++;
    if (duration > bucket.latencyMax) bucket.latencyMax = duration;
    if (isError) bucket.errors++;

    lifetime.totalRequests++;
    lifetime.latencySum += duration;
    lifetime.latencyCount++;
    if (isError) lifetime.totalErrors++;
  });

  next();
}

/**
 * Returns aggregated metrics for the SRE dashboard.
 */
function getMetricsSnapshot() {
  const now = Date.now();
  const windowStart = now - 60 * 60_000; // last 60 min

  let windowTotal = 0;
  let windowErrors = 0;
  let windowLatencySum = 0;
  let windowLatencyCount = 0;
  let windowLatencyMax = 0;
  const statusCounts = {};
  const routeCounts = {};
  const timeline = [];

  const sortedKeys = [...buckets.keys()].sort((a, b) => a - b);
  for (const key of sortedKeys) {
    if (key < windowStart) continue;
    const b = buckets.get(key);
    windowTotal += b.total;
    windowErrors += b.errors;
    windowLatencySum += b.latencySum;
    windowLatencyCount += b.latencyCount;
    if (b.latencyMax > windowLatencyMax) windowLatencyMax = b.latencyMax;

    for (const [s, c] of Object.entries(b.byStatus)) {
      statusCounts[s] = (statusCounts[s] || 0) + c;
    }
    for (const [r, c] of Object.entries(b.byRoute)) {
      routeCounts[r] = (routeCounts[r] || 0) + c;
    }

    timeline.push({
      timestamp: new Date(key).toISOString(),
      requests: b.total,
      errors: b.errors,
      avgLatency: b.latencyCount > 0 ? Math.round(b.latencySum / b.latencyCount) : 0,
    });
  }

  // Top 10 routes by request count
  const topRoutes = Object.entries(routeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([route, count]) => ({ route, count }));

  return {
    window: {
      durationMinutes: 60,
      totalRequests: windowTotal,
      totalErrors: windowErrors,
      errorRate: windowTotal > 0 ? +(windowErrors / windowTotal * 100).toFixed(2) : 0,
      avgLatencyMs: windowLatencyCount > 0 ? Math.round(windowLatencySum / windowLatencyCount) : 0,
      maxLatencyMs: windowLatencyMax,
      requestsPerMinute: +(windowTotal / 60).toFixed(2),
    },
    lifetime: {
      totalRequests: lifetime.totalRequests,
      totalErrors: lifetime.totalErrors,
      avgLatencyMs: lifetime.latencyCount > 0 ? Math.round(lifetime.latencySum / lifetime.latencyCount) : 0,
    },
    statusCodes: statusCounts,
    topRoutes,
    timeline,
  };
}

module.exports = { requestMetricsMiddleware, getMetricsSnapshot };
