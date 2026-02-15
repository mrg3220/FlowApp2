/**
 * ──────────────────────────────────────────────────────────
 * IT Admin Routes
 * ──────────────────────────────────────────────────────────
 * All endpoints require SUPER_ADMIN or IT_ADMIN role.
 * ──────────────────────────────────────────────────────────
 */

const express = require('express');
const { body, param } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  listUsers, getUser, changeUserRole, disableUser, enableUser,
  resetUserPassword, createUser,
  getAuditLogs,
  getSettings, upsertSetting,
  getAdminStats,
} = require('../controllers/adminController');

const router = express.Router();

// All admin routes require auth + admin role
router.use(authenticate, authorize('SUPER_ADMIN', 'IT_ADMIN'));

// ─── Dashboard Stats ─────────────────────────────────────
router.get('/stats', getAdminStats);

// ─── User Management ─────────────────────────────────────
router.get('/users', listUsers);
router.get('/users/:id', [param('id').isUUID()], validate, getUser);

router.post('/users/create', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('role').notEmpty(),
], validate, createUser);

router.put('/users/:id/role', [
  param('id').isUUID(),
  body('role').notEmpty(),
], validate, changeUserRole);

router.put('/users/:id/disable', [param('id').isUUID()], validate, disableUser);
router.put('/users/:id/enable', [param('id').isUUID()], validate, enableUser);

router.post('/users/:id/reset-password', [
  param('id').isUUID(),
  body('newPassword').isLength({ min: 8 }),
], validate, resetUserPassword);

// ─── Audit Logs ──────────────────────────────────────────
router.get('/audit-logs', getAuditLogs);

// ─── System Settings ─────────────────────────────────────
router.get('/settings', getSettings);
router.put('/settings/:key', [
  body('value').notEmpty(),
], validate, upsertSetting);

module.exports = router;
