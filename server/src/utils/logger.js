/**
 * ──────────────────────────────────────────────────────────
 * Structured Logger (Winston)
 * ──────────────────────────────────────────────────────────
 * Development: colorized, human-readable output with metadata
 * Production:  JSON lines for log aggregation (ELK, CloudWatch,
 *              Datadog, Loki, etc.)
 * ──────────────────────────────────────────────────────────
 */
const winston = require('winston');

const isProduction = process.env.NODE_ENV === 'production';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// ─── Development format: human-readable with colours ────
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? ` ${JSON.stringify(meta)}`
      : '';
    return `${timestamp} ${level}: ${message}${metaStr}`;
  })
);

// ─── Production format: structured JSON lines ───────────
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  levels,
  format: isProduction ? prodFormat : devFormat,
  defaultMeta: { service: 'flowapp-api' },
  transports: [new winston.transports.Console()],
});

module.exports = logger;
