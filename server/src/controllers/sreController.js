/**
 * ──────────────────────────────────────────────────────────
 * SRE Controller — System Reliability & Observability
 * ──────────────────────────────────────────────────────────
 * Endpoints for SUPER_ADMIN and IT_ADMIN users to monitor:
 *   - System health (process, memory, uptime)
 *   - Database metrics (table sizes, row counts, pool)
 *   - Request metrics (throughput, latency, error rates)
 *   - Error log entries
 *   - Runtime/environment info
 * ──────────────────────────────────────────────────────────
 */

const prisma = require('../config/database');
const os = require('os');
const { getMetricsSnapshot } = require('../middleware/requestMetrics');

// ─── System Health ───────────────────────────────────────

/**
 * GET /api/sre/health
 * Comprehensive system health check.
 */
const getSystemHealth = async (req, res, next) => {
  try {
    const mem = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // DB connectivity check
    let dbHealthy = false;
    let dbLatencyMs = 0;
    const dbStart = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbHealthy = true;
      dbLatencyMs = Date.now() - dbStart;
    } catch { dbLatencyMs = Date.now() - dbStart; }

    res.json({
      status: dbHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      process: {
        uptimeSeconds: Math.floor(process.uptime()),
        uptimeFormatted: formatUptime(process.uptime()),
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      memory: {
        rss: formatBytes(mem.rss),
        heapUsed: formatBytes(mem.heapUsed),
        heapTotal: formatBytes(mem.heapTotal),
        external: formatBytes(mem.external),
        rssBytes: mem.rss,
        heapUsedBytes: mem.heapUsed,
        heapTotalBytes: mem.heapTotal,
        heapUsagePercent: +((mem.heapUsed / mem.heapTotal) * 100).toFixed(1),
      },
      cpu: {
        userMicroseconds: cpuUsage.user,
        systemMicroseconds: cpuUsage.system,
      },
      os: {
        hostname: os.hostname(),
        type: os.type(),
        release: os.release(),
        totalMemory: formatBytes(os.totalmem()),
        freeMemory: formatBytes(os.freemem()),
        memoryUsagePercent: +(((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(1),
        cpuCores: os.cpus().length,
        loadAvg: os.loadavg(),
      },
      database: {
        healthy: dbHealthy,
        latencyMs: dbLatencyMs,
      },
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (err) { next(err); }
};

// ─── Database Metrics ────────────────────────────────────

/**
 * GET /api/sre/database
 * Database table sizes, row counts, and connection info.
 */
const getDatabaseMetrics = async (req, res, next) => {
  try {
    // Table row counts — use pg_class for speed
    const tableSizes = await prisma.$queryRaw`
      SELECT
        schemaname AS schema,
        relname AS table_name,
        n_live_tup AS row_count,
        pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
        pg_total_relation_size(relid) AS total_size_bytes
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
    `;

    // Database total size
    const dbSize = await prisma.$queryRaw`
      SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size,
             pg_database_size(current_database()) AS db_size_bytes
    `;

    // Active connections
    const connections = await prisma.$queryRaw`
      SELECT count(*) AS total,
             count(*) FILTER (WHERE state = 'active') AS active,
             count(*) FILTER (WHERE state = 'idle') AS idle,
             count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_transaction
      FROM pg_stat_activity
      WHERE datname = current_database()
    `;

    // PostgreSQL version
    const pgVersion = await prisma.$queryRaw`SHOW server_version`;

    // Table count
    const tableCount = await prisma.$queryRaw`
      SELECT count(*) AS count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;

    // Slow queries (if pg_stat_statements available, skip gracefully)
    let slowQueries = [];
    try {
      slowQueries = await prisma.$queryRaw`
        SELECT query, calls, mean_exec_time, max_exec_time, total_exec_time
        FROM pg_stat_statements
        ORDER BY mean_exec_time DESC
        LIMIT 10
      `;
    } catch { /* pg_stat_statements not loaded */ }

    const serialized = {
      databaseSize: dbSize[0]?.db_size || 'unknown',
      databaseSizeBytes: Number(dbSize[0]?.db_size_bytes || 0),
      postgresVersion: pgVersion[0]?.server_version || 'unknown',
      tableCount: Number(tableCount[0]?.count || 0),
      connections: {
        total: Number(connections[0]?.total || 0),
        active: Number(connections[0]?.active || 0),
        idle: Number(connections[0]?.idle || 0),
        idleInTransaction: Number(connections[0]?.idle_in_transaction || 0),
      },
      tables: tableSizes.map((t) => ({
        schema: t.schema,
        tableName: t.table_name,
        rowCount: Number(t.row_count),
        totalSize: t.total_size,
        totalSizeBytes: Number(t.total_size_bytes),
      })),
      slowQueries: slowQueries.map((q) => ({
        query: q.query?.substring(0, 200),
        calls: Number(q.calls),
        meanMs: +Number(q.mean_exec_time).toFixed(2),
        maxMs: +Number(q.max_exec_time).toFixed(2),
      })),
    };

    res.json(serialized);
  } catch (err) { next(err); }
};

// ─── Request Metrics ─────────────────────────────────────

/**
 * GET /api/sre/requests
 * API request throughput, latency, error rates from in-memory collector.
 */
const getRequestMetrics = async (req, res, next) => {
  try {
    const snapshot = getMetricsSnapshot();
    res.json(snapshot);
  } catch (err) { next(err); }
};

// ─── Error Logs / Recent Audit Events ────────────────────

/**
 * GET /api/sre/errors
 * Recent error-type audit entries and system events.
 * Query: ?hours=24&limit=100
 */
const getRecentErrors = async (req, res, next) => {
  try {
    const hours = Math.min(parseInt(req.query.hours, 10) || 24, 168); // max 7 days
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const since = new Date(Date.now() - hours * 60 * 60_000);

    const logs = await prisma.auditLog.findMany({
      where: {
        createdAt: { gte: since },
        action: { in: ['LOGIN_FAILED', 'SESSION_REVOKED', 'USER_DISABLED'] },
      },
      include: {
        performer: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.json({ logs, since: since.toISOString(), count: logs.length });
  } catch (err) { next(err); }
};

// ─── Runtime Info ────────────────────────────────────────

/**
 * GET /api/sre/runtime
 * Node.js runtime & dependency info for the SRE quick-glance panel.
 */
const getRuntimeInfo = async (req, res, next) => {
  try {
    const pkg = require('../../package.json');

    res.json({
      app: {
        name: pkg.name,
        version: pkg.version || '1.0.0',
        nodeEnv: process.env.NODE_ENV || 'development',
      },
      node: {
        version: process.version,
        v8Version: process.versions.v8,
        opensslVersion: process.versions.openssl,
      },
      dependencies: {
        express: pkg.dependencies?.express,
        prisma: pkg.dependencies?.['@prisma/client'],
        helmet: pkg.dependencies?.helmet,
        'express-rate-limit': pkg.dependencies?.['express-rate-limit'],
      },
      startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  } catch (err) { next(err); }
};

// ─── Combined SRE Dashboard ─────────────────────────────

/**
 * GET /api/sre/dashboard
 * Aggregated snapshot for the SRE dashboard page.
 */
const getSREDashboard = async (req, res, next) => {
  try {
    const mem = process.memoryUsage();
    let dbHealthy = false;
    let dbLatencyMs = 0;
    const dbStart = Date.now();
    try { await prisma.$queryRaw`SELECT 1`; dbHealthy = true; dbLatencyMs = Date.now() - dbStart; } catch { dbLatencyMs = Date.now() - dbStart; }

    const requestMetrics = getMetricsSnapshot();

    const [userCount, schoolCount, sessionCount, recentErrors] = await Promise.all([
      prisma.user.count(),
      prisma.school.count(),
      prisma.classSession.count(),
      prisma.auditLog.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) },
          action: { in: ['LOGIN_FAILED'] },
        },
      }),
    ]);

    res.json({
      health: {
        status: dbHealthy ? 'healthy' : 'degraded',
        uptime: formatUptime(process.uptime()),
        uptimeSeconds: Math.floor(process.uptime()),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
      },
      memory: {
        heapUsed: formatBytes(mem.heapUsed),
        heapTotal: formatBytes(mem.heapTotal),
        rss: formatBytes(mem.rss),
        heapPercent: +((mem.heapUsed / mem.heapTotal) * 100).toFixed(1),
      },
      database: {
        healthy: dbHealthy,
        latencyMs: dbLatencyMs,
      },
      requests: requestMetrics.window,
      counts: { users: userCount, schools: schoolCount, sessions: sessionCount },
      failedLoginsLast24h: recentErrors,
    });
  } catch (err) { next(err); }
};

// ─── Utility ─────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

module.exports = {
  getSystemHealth, getDatabaseMetrics, getRequestMetrics,
  getRecentErrors, getRuntimeInfo, getSREDashboard,
};
