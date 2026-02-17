/**
 * Structured logger — thin wrapper that honours LOG_LEVEL.
 *
 * In a production Lambda you would push JSON lines to CloudWatch;
 * here we keep it simple but structured so it can be piped into
 * any log aggregator.
 */

import { config } from './config.js';

const LEVELS = /** @type {const} */ (['debug', 'info', 'warn', 'error']);
const threshold = LEVELS.indexOf(config.LOG_LEVEL);

/**
 * @param {'debug'|'info'|'warn'|'error'} level
 * @param {string} message
 * @param {Record<string,unknown>} [meta]
 */
function log(level, message, meta) {
  if (LEVELS.indexOf(level) < threshold) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  const fn = level === 'error' ? console.error : console.log;
  fn(JSON.stringify(entry));
}

export const logger = {
  debug: (msg, meta) => log('debug', msg, meta),
  info:  (msg, meta) => log('info',  msg, meta),
  warn:  (msg, meta) => log('warn',  msg, meta),
  error: (msg, meta) => log('error', msg, meta),
};
