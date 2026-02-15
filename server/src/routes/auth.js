/**
 * ──────────────────────────────────────────────────────────
 * Authentication Routes
 * ──────────────────────────────────────────────────────────
 * POST /api/auth/register — create a new user account
 * POST /api/auth/login    — obtain a JWT token
 * GET  /api/auth/me       — get current user profile
 *
 * Security:
 *   - Rate limited at the router level (authLimiter in index.js)
 *   - Input validation via express-validator
 *   - Password complexity enforced both here and in controller
 * ──────────────────────────────────────────────────────────
 */
const express = require('express');
const { body } = require('express-validator');
const { register, login, getMe } = require('../controllers/authController');
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

router.get('/me', authenticate, getMe);

module.exports = router;
