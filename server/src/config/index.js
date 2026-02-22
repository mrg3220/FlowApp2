/**
 * ──────────────────────────────────────────────────────────
 * Application Configuration
 * ──────────────────────────────────────────────────────────
 * Centralises all environment variable access and validates
 * that required secrets are present at startup (fail-fast).
 *
 * Security: prevents the server from running with weak defaults
 * in production, which would leave authentication wide open.
 * ──────────────────────────────────────────────────────────
 */
require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';

// ─── Validate critical secrets in production ──────────────
// Defence-in-depth: fail hard if secrets are missing or weak.
// This prevents accidental deployment with placeholder values.
if (nodeEnv === 'production') {
  const jwtSecret = process.env.JWT_SECRET || '';
  const weakSecrets = [
    'dev-secret-change-me',
    'flowapp-docker-jwt-secret-change-in-production',
    'CHANGE_ME_generate_with_crypto_randomBytes_64',
    '',
  ];

  if (weakSecrets.includes(jwtSecret) || jwtSecret.length < 32) {
    console.error(
      '🚨 FATAL: JWT_SECRET is missing, too short, or uses a known placeholder.\n' +
      '   Generate a secure secret: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"\n' +
      '   Set it in your .env file or Docker environment.'
    );
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('🚨 FATAL: DATABASE_URL is not set. Cannot start without a database connection.');
    process.exit(1);
  }
}

module.exports = {
  /** Server port */
  port: parseInt(process.env.PORT, 10) || 3001,

  /** JWT signing secret — must be strong in production */
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',

  /** Access token lifetime — short-lived for security (default 15 min) */
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',

  /** Refresh token lifetime in days (default 30 days) */
  refreshTokenExpiresInDays: parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS, 10) || 30,

  /** Current environment: 'development' | 'production' | 'test' */
  nodeEnv,

  /** Allowed CORS origins (comma-separated in env) */
  corsOrigin: process.env.CORS_ORIGIN || '*',

  /** Redis connection URL (optional — graceful degradation without it) */
  redisUrl: process.env.REDIS_URL || '',
};
