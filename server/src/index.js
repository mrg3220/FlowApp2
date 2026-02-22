/**
 * ──────────────────────────────────────────────────────────
 * FlowApp2 — Express API Server Entry Point
 * ──────────────────────────────────────────────────────────
 * Initialises middleware, routes, security controls, and
 * scheduled services. See inline security comments for the
 * threat model behind each middleware choice.
 * ──────────────────────────────────────────────────────────
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const logger = require('./utils/logger');
const { getRedis, isReady: isRedisReady, disconnectRedis } = require('./config/redis');
const prisma = require('./config/database');

// ─── Route imports ───────────────────────────────────────
const authRoutes = require('./routes/auth');
const programOfferingRoutes = require('./routes/programOfferings'); // "Programs" (was classes)
const classInstanceRoutes = require('./routes/classInstances');     // "Classes" (was sessions)
// Legacy route aliases for backward compatibility
const classRoutes = require('./routes/classes');                    // Deprecated: use /api/programs
const sessionRoutes = require('./routes/sessions');                 // Deprecated: use /api/classes
const checkInRoutes = require('./routes/checkins');
const userRoutes = require('./routes/users');
const schoolRoutes = require('./routes/schools');
const enrollmentRoutes = require('./routes/enrollments');
const profileRoutes = require('./routes/profile');
const metricsRoutes = require('./routes/metrics');
const billingRoutes = require('./routes/billing');
const promotionRoutes = require('./routes/promotions');
const notificationRoutes = require('./routes/notifications');
const familyRoutes = require('./routes/families');
const studentPortalRoutes = require('./routes/studentPortal');
const leadRoutes = require('./routes/leads');
const curriculumRoutes = require('./routes/curriculum');
const reportingRoutes = require('./routes/reporting');
const waiverRoutes = require('./routes/waivers');
const retailRoutes = require('./routes/retail');
const certificateRoutes = require('./routes/certificates');
const trainingPlanRoutes = require('./routes/trainingPlans');
const payrollRoutes = require('./routes/payroll');
const eventRoutes = require('./routes/events');
const venueRoutes = require('./routes/venues');
const certificationRoutes = require('./routes/certifications');
const brandingRoutes = require('./routes/branding');
const helpRoutes = require('./routes/help');
const publicRoutes = require('./routes/public');
const virtualRoutes = require('./routes/virtual');
const competitionRoutes = require('./routes/competitions');
const adminRoutes = require('./routes/admin');
const sreRoutes = require('./routes/sre');
const { requestMetricsMiddleware, getMetricsSnapshot } = require('./middleware/requestMetrics');

const app = express();

// ─── Initialize Redis (lazy, non-blocking) ───────────────
getRedis();

// ──────────────────────────────────────────────────────────
// Security Middleware
// ──────────────────────────────────────────────────────────

/**
 * Helmet — sets secure HTTP response headers.
 * Mitigates: clickjacking, MIME sniffing, XSS, information leakage.
 * This is a baseline defence layer; Nginx adds additional headers.
 */
app.use(helmet());

/**
 * CORS — restrict cross-origin requests to known origins.
 * Mitigates: unauthorized third-party API access.
 * In production, CORS_ORIGIN should be set to the exact frontend URL.
 */
const corsOptions = {
  origin: config.corsOrigin === '*'
    ? '*'
    : config.corsOrigin.split(',').map((o) => o.trim()),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 600,  // Pre-flight cache: 10 minutes
};
app.use(cors(corsOptions));

/**
 * Compression — gzip/deflate response bodies.
 * Reduces bandwidth by ~70% for JSON payloads.
 * Skip for responses < 1KB (compression overhead not worth it).
 */
app.use(compression({ threshold: 1024 }));

/**
 * HPP — HTTP Parameter Pollution protection.
 * Mitigates: parameter pollution attacks that exploit Express
 * handling of duplicate query parameters.
 */
app.use(hpp());

/**
 * Body parser with size limit.
 * Mitigates: denial-of-service via oversized JSON payloads.
 */
app.use(express.json({ limit: '1mb' }));

/**
 * HTTP request logger — structured access logs for observability.
 */
app.use(requestLogger);

/**
 * Request metrics collector — tracks throughput, latency,
 * error rates per endpoint for the SRE dashboard.
 */
app.use(requestMetricsMiddleware);

/**
 * Global rate limiter — prevents abuse across all endpoints.
 * Mitigates: brute-force attacks, scraping, denial of service.
 * 200 requests per 15-minute window per IP.
 */
/**
 * Build rate-limit store configuration.
 * Uses Redis when available for multi-instance consistency;
 * falls back to in-memory for single-instance deployments.
 */
function buildRateLimitStore(prefix = 'rl') {
  if (config.redisUrl) {
    try {
      const { RedisStore } = require('rate-limit-redis');
      return new RedisStore({
        sendCommand: (...args) => getRedis().call(...args),
        prefix: `${prefix}:`,
      });
    } catch (err) {
      logger.warn(`Rate-limit Redis store unavailable: ${err.message} — using in-memory`);
    }
  }
  return undefined; // express-rate-limit default MemoryStore
}

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildRateLimitStore('rl-global'),
  message: { error: 'Too many requests. Please try again later.' },
});
app.use(globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  store: buildRateLimitStore('rl-auth'),
  message: { error: 'Too many authentication attempts. Please wait 15 minutes.' },
});

const publicWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  store: buildRateLimitStore('rl-public'),
  message: { error: 'Too many requests. Please try again later.' },
});

// ──────────────────────────────────────────────────────────
// Health & Observability Endpoints (no auth)
// ──────────────────────────────────────────────────────────

/**
 * Liveness probe — checks API, database, and Redis health.
 * Used by Docker HEALTHCHECK and Kubernetes livenessProbe.
 */
app.get('/api/health', async (_req, res) => {
  const checks = { api: 'ok' };
  let httpStatus = 200;

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
    httpStatus = 503;
  }

  try {
    if (isRedisReady()) {
      await getRedis().ping();
      checks.redis = 'ok';
    } else {
      checks.redis = 'not-configured';
    }
  } catch {
    checks.redis = 'degraded';
  }

  res.status(httpStatus).json({
    status: httpStatus === 200 ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    version: process.env.npm_package_version || '1.0.0',
    checks,
  });
});

/**
 * Readiness probe — indicates the server can accept traffic.
 */
app.get('/api/health/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not-ready', reason: 'database-unavailable' });
  }
});

/**
 * Prometheus-compatible metrics endpoint.
 * Exports key counters and gauges in text exposition format.
 */
app.get('/api/metrics/prometheus', (_req, res) => {
  const snapshot = getMetricsSnapshot();
  const mem = process.memoryUsage();
  const lines = [
    '# HELP flowapp_http_requests_total Total HTTP requests',
    '# TYPE flowapp_http_requests_total counter',
    `flowapp_http_requests_total ${snapshot.lifetime.totalRequests}`,
    '',
    '# HELP flowapp_http_errors_total Total HTTP errors (4xx+5xx)',
    '# TYPE flowapp_http_errors_total counter',
    `flowapp_http_errors_total ${snapshot.lifetime.totalErrors}`,
    '',
    '# HELP flowapp_http_request_duration_ms_avg Average request duration',
    '# TYPE flowapp_http_request_duration_ms_avg gauge',
    `flowapp_http_request_duration_ms_avg ${snapshot.lifetime.avgLatencyMs}`,
    '',
    '# HELP flowapp_http_requests_per_minute Requests per minute (60m window)',
    '# TYPE flowapp_http_requests_per_minute gauge',
    `flowapp_http_requests_per_minute ${snapshot.window.requestsPerMinute}`,
    '',
    '# HELP flowapp_process_uptime_seconds Process uptime',
    '# TYPE flowapp_process_uptime_seconds gauge',
    `flowapp_process_uptime_seconds ${Math.round(process.uptime())}`,
    '',
    '# HELP flowapp_process_memory_rss_bytes Resident Set Size',
    '# TYPE flowapp_process_memory_rss_bytes gauge',
    `flowapp_process_memory_rss_bytes ${mem.rss}`,
    '',
    '# HELP flowapp_process_memory_heap_used_bytes V8 heap used',
    '# TYPE flowapp_process_memory_heap_used_bytes gauge',
    `flowapp_process_memory_heap_used_bytes ${mem.heapUsed}`,
    '',
  ];
  for (const [code, count] of Object.entries(snapshot.statusCodes)) {
    lines.push(`flowapp_http_responses_total{status="${code}"} ${count}`);
  }
  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(lines.join('\n') + '\n');
});

// ──────────────────────────────────────────────────────────
// Route Registration
// ──────────────────────────────────────────────────────────

// Auth routes get the strict rate limiter to prevent brute-force
app.use('/api/auth', authLimiter, authRoutes);

// Standard authenticated API routes
app.use('/api/schools', schoolRoutes);
app.use('/api/programs', programOfferingRoutes);      // NEW: Program offerings (was /api/classes)
app.use('/api/class-instances', classInstanceRoutes); // NEW: Class instances (was /api/sessions)
// Legacy aliases for backward compatibility
app.use('/api/classes', classRoutes);                 // Deprecated: use /api/programs
app.use('/api/sessions', sessionRoutes);              // Deprecated: use /api/class-instances
app.use('/api/checkins', checkInRoutes);
app.use('/api/users', userRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/families', familyRoutes);
app.use('/api/student-portal', studentPortalRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/curriculum', curriculumRoutes);
app.use('/api/reporting', reportingRoutes);
app.use('/api/waivers', waiverRoutes);
app.use('/api/retail', retailRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/training-plans', trainingPlanRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/certifications', certificationRoutes);
app.use('/api/branding', brandingRoutes);
app.use('/api/help', helpRoutes);
app.use('/api/virtual', virtualRoutes);
app.use('/api/competitions', competitionRoutes);

// IT Admin & SRE routes — restricted to SUPER_ADMIN and IT_ADMIN
app.use('/api/admin', adminRoutes);
app.use('/api/sre', sreRoutes);

// Public routes — stricter rate limit on writes, global limit on reads
app.use('/api/public', publicWriteLimiter, publicRoutes);

// ─── 404 handler ─────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global error handler (must be last) ─────────────────
app.use(errorHandler);

// ──────────────────────────────────────────────────────────
// Start Server & Scheduled Services
// ──────────────────────────────────────────────────────────
const { startScheduler } = require('./services/autoInvoice');
const { startNotificationScheduler } = require('./services/notificationService');

const server = app.listen(config.port, () => {
  logger.info(`🥋 FlowApp API running on http://localhost:${config.port}`);
  logger.info(`   Environment: ${config.nodeEnv}`);
  logger.info(`   CORS origin: ${config.corsOrigin}`);
  startScheduler();
  startNotificationScheduler();
});

// ─── Graceful shutdown ───────────────────────────────────
// Ensures in-flight requests complete before process exits.
// Docker sends SIGTERM; Ctrl+C sends SIGINT.
function gracefulShutdown(signal) {
  logger.info(`\n${signal} received — shutting down gracefully…`);
  server.close(async () => {
    logger.info('   HTTP server closed');
    try { await require('./config/database').$disconnect(); } catch { /* ignore */ }
    logger.info('   Database disconnected');
    try { await disconnectRedis(); } catch { /* ignore */ }
    process.exit(0);
  });
  // Force exit after 10s if connections don't drain
  setTimeout(() => { logger.error('   Forced shutdown (timeout)'); process.exit(1); }, 10000);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
