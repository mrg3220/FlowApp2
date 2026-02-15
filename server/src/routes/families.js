const express = require('express');
const { body } = require('express-validator');
const {
  getFamilies,
  getFamily,
  createFamily,
  updateFamily,
  addMember,
  updateMember,
  removeMember,
  getMyFamilies,
  getFamilyBilling,
} = require('../controllers/familyController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.use(authenticate);

// ─── Current user's families ─────────────────────────────
router.get('/mine', getMyFamilies);

// ─── School families (staff) ─────────────────────────────
router.get(
  '/school/:schoolId',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'),
  getFamilies
);

// ─── Single family detail ────────────────────────────────
router.get('/:familyId', getFamily);

// ─── Create family ───────────────────────────────────────
router.post(
  '/school/:schoolId',
  authorize('SUPER_ADMIN', 'OWNER'),
  [body('name').notEmpty().withMessage('Family name is required')],
  validate,
  createFamily
);

// ─── Update family ───────────────────────────────────────
router.put(
  '/:familyId',
  authorize('SUPER_ADMIN', 'OWNER'),
  updateFamily
);

// ─── Family billing ──────────────────────────────────────
router.get('/:familyId/billing', getFamilyBilling);

// ─── Add member ──────────────────────────────────────────
router.post(
  '/:familyId/members',
  authorize('SUPER_ADMIN', 'OWNER'),
  [body('userId').notEmpty().withMessage('User ID is required')],
  validate,
  addMember
);

// ─── Update member role ──────────────────────────────────
router.patch(
  '/members/:memberId',
  authorize('SUPER_ADMIN', 'OWNER'),
  [body('familyRole').isIn(['PRIMARY', 'SECONDARY', 'CHILD']).withMessage('Invalid family role')],
  validate,
  updateMember
);

// ─── Remove member ───────────────────────────────────────
router.delete(
  '/members/:memberId',
  authorize('SUPER_ADMIN', 'OWNER'),
  removeMember
);

module.exports = router;
