/**
 * ──────────────────────────────────────────────────────────
 * Authentication Routes
 * ──────────────────────────────────────────────────────────
 * POST /api/auth/register — create a new user account
 * POST /api/auth/login    — obtain access + refresh tokens
 * POST /api/auth/refresh  — rotate refresh token for new token pair
 * POST /api/auth/logout   — revoke refresh token
 * GET  /api/auth/me       — get current user profile
 *
 * Security:
 *   - Rate limited at the router level (authLimiter in index.js)
 *   - Input validation via express-validator
 *   - Password complexity enforced both here and in controller
 *   - Short-lived access tokens (15 min) + long-lived refresh tokens (30 days)
 * ──────────────────────────────────────────────────────────
 */
const express = require('express');
const { body } = require('express-validator');
const { register, login, refresh, logout, getMe } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.post(
  '/register',
  [
    body('email')
      .isEmail().withMessage('Valid email is required')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
      .matches(/[a-z]/).withMessage('Password must contain a lowercase letter')
      .matches(/[0-9]/).withMessage('Password must contain a digit'),
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
  ],
  validate,
  register
);

router.post(
  '/login',
  [
    body('email')
      .isEmail().withMessage('Valid email is required')
      .normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  login
);

router.post(
  '/refresh',
  [
    body('refreshToken').notEmpty().withMessage('Refresh token is required'),
  ],
  validate,
  refresh
);

router.post('/logout', logout);

router.get('/me', authenticate, getMe);

module.exports = router;
