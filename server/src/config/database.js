/**
 * ──────────────────────────────────────────────────────────
 * Prisma Database Client (Singleton)
 * ──────────────────────────────────────────────────────────
 * Exports a single PrismaClient instance for the entire application.
 * All database access goes through this module to ensure:
 *   - Connection pooling is shared (not duplicated per import)
 *   - Logging configuration is centralised
 *   - Shutdown handlers can be attached in one place
 *
 * Logging:
 *   - Development: queries + errors + warnings (for debugging)
 *   - Production: errors only (avoid leaking data in logs)
 * ──────────────────────────────────────────────────────────
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
});

// Graceful shutdown: close DB connections when the process exits.
// Prevents connection leaks during container restarts.
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = prisma;
