/**
 * ──────────────────────────────────────────────────────────
 * Authentication Controller
 * ──────────────────────────────────────────────────────────
 * Handles user registration, login, token refresh, and logout.
 *
 * Security design:
 *   - Short-lived access tokens (15 min) + long-lived refresh tokens (30 days)
 *   - Refresh tokens are opaque random strings, stored hashed (SHA-256)
 *   - Refresh token rotation: every refresh issues a new pair and revokes the old
 *   - Reuse detection: if a revoked token is used, all user sessions are revoked
 *   - Passwords hashed with bcrypt (cost factor 12)
 *   - Login error messages are intentionally identical (prevents user enumeration)
 *   - Role escalation guarded: only SUPER_ADMIN/OWNER can assign non-STUDENT roles
 * ──────────────────────────────────────────────────────────
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const config = require('../config');

/** Minimum password length */
const MIN_PASSWORD_LENGTH = 8;

/**
 * Validates password complexity requirements.
 * Requires at least one uppercase, one lowercase, one digit,
 * and minimum length.
 *
 * @param {string} password - The plaintext password to validate
 * @returns {string|null} Error message if invalid, null if valid
 */
function validatePasswordStrength(password) {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one digit';
  }
  return null;
}

// ─── Token helpers ───────────────────────────────────────

/**
 * Generates a short-lived JWT access token.
 * @param {string} userId
 * @returns {string} Signed JWT
 */
function generateAccessToken(userId) {
  return jwt.sign({ userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

/**
 * Generates a cryptographically random refresh token,
 * stores its SHA-256 hash in the database, and returns the raw token.
 *
 * @param {string} userId
 * @param {import('express').Request} req - For extracting user-agent / IP
 * @returns {Promise<{rawToken: string, expiresAt: Date}>}
 */
async function generateRefreshToken(userId, req) {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + config.refreshTokenExpiresInDays);

  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
      userAgent: req.headers['user-agent'] || null,
      ipAddress: req.ip || req.connection?.remoteAddress || null,
    },
  });

  return { rawToken, expiresAt };
}

/**
 * Issues both access + refresh tokens and sends the standard auth response.
 * @param {object} user - Prisma user (with select fields)
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {number} [statusCode=200]
 */
async function sendTokenPair(user, req, res, statusCode = 200) {
  const accessToken = generateAccessToken(user.id);
  const { rawToken: refreshToken, expiresAt } = await generateRefreshToken(user.id, req);

  res.status(statusCode).json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      title: user.title,
      schoolId: user.schoolId,
    },
    token: accessToken,
    refreshToken,
    expiresAt: expiresAt.toISOString(),
  });
}

// ─── Route handlers ──────────────────────────────────────

/**
 * POST /api/auth/register
 *
 * Creates a new user account. Self-registration defaults to STUDENT role.
 * Non-student roles require an authenticated SUPER_ADMIN or OWNER.
 */
const register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, phone, role, schoolId } = req.body;

    // Server-side password complexity check (defence in depth — don't trust client)
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    // Check for existing account
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Role escalation guard: only SUPER_ADMIN/OWNER can assign privileged roles
    let assignedRole = 'STUDENT';
    if (role && role !== 'STUDENT') {
      if (req.user && (req.user.role === 'SUPER_ADMIN' || req.user.role === 'OWNER')) {
        assignedRole = role;
      } else {
        return res.status(403).json({ error: 'Only admins and owners can assign non-student roles' });
      }
    }

    // Hash password with bcrypt cost factor 12 (balance of security vs. latency)
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        phone: phone || null,
        role: assignedRole,
        schoolId: schoolId || null,
      },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, title: true, schoolId: true, createdAt: true,
      },
    });

    await sendTokenPair(user, req, res, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 *
 * Authenticates a user and returns access + refresh tokens.
 *
 * Security: uses the same error message for both "email not found"
 * and "wrong password" to prevent user enumeration attacks.
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    await sendTokenPair(user, req, res);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/refresh
 *
 * Exchanges a valid refresh token for a new access + refresh token pair.
 * Implements rotation: the old refresh token is revoked when a new one is issued.
 * Reuse detection: if a revoked token is presented, all user sessions are revoked.
 *
 * @body {string} refreshToken - The opaque refresh token (not the hash)
 */
const refresh = async (req, res, next) => {
  try {
    const { refreshToken: rawToken } = req.body;
    if (!rawToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, role: true, title: true, schoolId: true, isActive: true } } },
    });

    // Token not found
    if (!storedToken) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // ─── Reuse detection ─────────────────────────────────
    // If someone presents a token that was already rotated,
    // it means the token was stolen. Revoke ALL sessions for safety.
    if (storedToken.revokedAt) {
      await prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return res.status(401).json({ error: 'Token reuse detected — all sessions revoked' });
    }

    // Token expired
    if (storedToken.expiresAt < new Date()) {
      await prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    // User deactivated
    if (!storedToken.user.isActive) {
      return res.status(403).json({ error: 'Account has been disabled' });
    }

    // ─── Rotate: revoke old, issue new ───────────────────
    const accessToken = generateAccessToken(storedToken.userId);
    const newRaw = crypto.randomBytes(40).toString('hex');
    const newHash = crypto.createHash('sha256').update(newRaw).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.refreshTokenExpiresInDays);

    // Atomic: revoke old + create new in a transaction
    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date(), replacedBy: newHash },
      }),
      prisma.refreshToken.create({
        data: {
          tokenHash: newHash,
          userId: storedToken.userId,
          expiresAt,
          userAgent: req.headers['user-agent'] || null,
          ipAddress: req.ip || req.connection?.remoteAddress || null,
        },
      }),
    ]);

    res.json({
      user: storedToken.user,
      token: accessToken,
      refreshToken: newRaw,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/logout
 *
 * Revokes the presented refresh token.
 *
 * @body {string} refreshToken - The opaque refresh token to revoke
 */
const logout = async (req, res, next) => {
  try {
    const { refreshToken: rawToken } = req.body;
    if (rawToken) {
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      await prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 *
 * Returns the current authenticated user's profile.
 * Requires a valid JWT token (authenticate middleware).
 */
const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, title: true, schoolId: true, bio: true, beltRank: true,
        school: { select: { id: true, name: true } },
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (error) { next(error); }
};

module.exports = { register, login, refresh, logout, getMe };
