const logger = require('../utils/logger');

/**
 * ──────────────────────────────────────────────────────────
 * Global Error Handling Middleware
 * ──────────────────────────────────────────────────────────
 * Catches all unhandled errors from route handlers and
 * returns a safe, structured JSON response.
 *
 * Security:
 *   - Stack traces and internal details are NEVER sent to clients
 *   - Prisma error codes are mapped to safe HTTP responses
 *   - 500 errors always return a generic message to prevent
 *     information leakage (DB structure, file paths, etc.)
 *   - Stack traces are logged server-side only via structured logging
 * ──────────────────────────────────────────────────────────
 */
const errorHandler = (err, req, res, _next) => {
  const isDev = process.env.NODE_ENV === 'development';
  
  // Log only 500s as errors, 4xx as warnings to reduce noise
  const status = err.status || 500;
  
  if (status >= 500) {
    logger.error(err.message, { 
      stack: err.stack, 
      code: err.code, 
      path: req.path, 
      method: req.method 
    });
  } else {
    logger.warn(`Client Error (${status}): ${err.message}`, {
      path: req.path,
      method: req.method
    });
  }

  // ─── Prisma-specific error mapping ─────────────────────
  // P2002: unique constraint violation (e.g., duplicate email)
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'A record with that value already exists',
    });
  }
  // P2025: record not found (e.g., delete/update on missing row)
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' });
  }

  // ─── Validation errors from express-validator ──────────
  if (err.type === 'validation') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors,
    });
  }

  // ─── Default: hide internal details from the client ────
  res.status(status).json({
    error: status === 500 ? 'Internal server error' : err.message,
  });
};

module.exports = errorHandler;
