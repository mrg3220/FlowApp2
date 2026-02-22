/**
 * ──────────────────────────────────────────────────────────
 * HTTP Request Logger Middleware
 * ──────────────────────────────────────────────────────────
 * Logs every request with method, URL, status, duration,
 * and caller identity. Uses the Winston 'http' level so it
 * can be filtered independently from application logs.
 *
 * In production (JSON format), these logs are ready for
 * ingestion by ELK, CloudWatch Logs, or Datadog.
 * ──────────────────────────────────────────────────────────
 */
const logger = require('../utils/logger');

/**
 * Express middleware — attach early in the chain (after
 * body parsers, before routes) to capture all requests.
 */
function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const status = res.statusCode;

    const meta = {
      method: req.method,
      url: req.originalUrl,
      status,
      durationMs: +durationMs.toFixed(1),
      ip: req.ip,
      userId: req.user?.id || undefined,
      contentLength: res.get('Content-Length') || 0,
      userAgent: req.get('User-Agent'),
    };

    // Route health checks to debug level to reduce noise
    if (req.originalUrl === '/api/health') {
      return logger.debug('health-probe', meta);
    }

    if (status >= 500) {
      logger.error('request', meta);
    } else if (status >= 400) {
      logger.warn('request', meta);
    } else {
      logger.http('request', meta);
    }
  });

  next();
}

module.exports = requestLogger;
