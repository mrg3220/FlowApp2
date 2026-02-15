/**
 * ──────────────────────────────────────────────────────────
 * Authentication & Authorization Middleware
 * ──────────────────────────────────────────────────────────
 * Security design:
 *   - authenticate: verifies JWT Bearer token, attaches user
 *   - authorize: role-based access control (RBAC) gate
 *
 * Threat model:
 *   - Stolen/forged tokens → JWT signature verification
 *   - Expired tokens → exp claim check (built into jwt.verify)
 *   - Deleted users → DB lookup on every request
 *   - Privilege escalation → explicit role whitelist in authorize()
 *
 * Error responses are intentionally generic to avoid
 * information leakage about valid user accounts.
 * ──────────────────────────────────────────────────────────
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const prisma = require('../config/database');

/**
 * Verifies the JWT Bearer token from the Authorization header
 * and attaches the authenticated user object to `req.user`.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 *
 * @returns 401 if token is missing, malformed, expired, or user not found
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Require "Bearer <token>" format — reject anything else
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];

    // Basic format guard: a JWT has exactly 3 dot-separated segments
    if (!token || token.split('.').length !== 3) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    // Verify signature and expiry (throws on failure)
    const decoded = jwt.verify(token, config.jwtSecret);

    // Fetch the user from DB — ensures deleted/deactivated users can't act
    // Select only the fields needed downstream (least data principle)
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        title: true,
        schoolId: true,
      },
    });

    if (!user) {
      // Generic message — don't reveal whether the user existed
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  } catch (error) {
    // JWT-specific errors → 401 (not a server error)
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    // Unexpected errors → pass to global error handler
    next(error);
  }
};

/**
 * Role-based authorization gate.
 * Must be used AFTER authenticate() in the middleware chain.
 *
 * @param {...string} roles - Whitelisted roles (e.g., 'SUPER_ADMIN', 'OWNER')
 * @returns Express middleware that allows only the listed roles
 *
 * @example
 *   router.get('/admin', authenticate, authorize('SUPER_ADMIN'), handler);
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      // 403 Forbidden — authenticated but not authorized
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
