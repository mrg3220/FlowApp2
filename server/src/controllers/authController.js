/**
 * ──────────────────────────────────────────────────────────
 * Authentication Controller
 * ──────────────────────────────────────────────────────────
 * Handles user registration, login, and token-based identity.
 *
 * Security design:
 *   - Passwords hashed with bcrypt (cost factor 12)
 *   - Login error messages are intentionally identical for
 *     wrong email vs. wrong password (prevents user enumeration)
 *   - Role escalation guarded: only SUPER_ADMIN/OWNER can
 *     assign non-STUDENT roles
 *   - Password complexity enforced server-side (not just client)
 * ──────────────────────────────────────────────────────────
 */
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

/**
 * POST /api/auth/register
 *
 * Creates a new user account. Self-registration defaults to STUDENT role.
 * Non-student roles require an authenticated SUPER_ADMIN or OWNER.
 *
 * @body {string} email     - Unique email address
 * @body {string} password  - Must meet complexity requirements
 * @body {string} firstName
 * @body {string} lastName
 * @body {string} [phone]
 * @body {string} [role]     - Only honoured if caller is SUPER_ADMIN/OWNER
 * @body {string} [schoolId]
 *
 * @returns {201} { user, token }
 * @returns {400} Validation errors
 * @returns {403} Role escalation denied
 * @returns {409} Email already registered
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
        role: true, schoolId: true, createdAt: true,
      },
    });

    const token = jwt.sign({ userId: user.id }, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
    });

    res.status(201).json({ user, token });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 *
 * Authenticates a user and returns a JWT token.
 *
 * Security: uses the same error message for both "email not found"
 * and "wrong password" to prevent user enumeration attacks.
 *
 * @body {string} email
 * @body {string} password
 *
 * @returns {200} { user, token }
 * @returns {401} Invalid credentials
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Intentionally same message as wrong password (user enumeration defence)
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.id }, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        title: user.title,
        schoolId: user.schoolId,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 *
 * Returns the current authenticated user's profile.
 * Requires a valid JWT token (authenticate middleware).
 *
 * @returns {200} { user }
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

module.exports = { register, login, getMe };
