const express = require('express');
const { body } = require('express-validator');
const {
  getMyNotifications,
  markRead,
  getPreferences,
  updatePreference,
  getTemplates,
  upsertTemplate,
  sendManualNotification,
  getSchoolNotifications,
  triggerScheduledJobs,
} = require('../controllers/notificationController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.use(authenticate);

// ─── User inbox ──────────────────────────────────────────
router.get('/mine', getMyNotifications);

router.put(
  '/read',
  [body('ids').notEmpty().withMessage('Provide notification ids or "all"')],
  validate,
  markRead
);

// ─── User notification preferences ───────────────────────
router.get('/preferences', getPreferences);

router.put(
  '/preferences',
  [
    body('type').notEmpty(),
    body('channel').notEmpty(),
    body('enabled').isBoolean(),
  ],
  validate,
  updatePreference
);

// ─── Staff: templates per school ─────────────────────────
router.get(
  '/templates/:schoolId',
  authorize('SUPER_ADMIN', 'OWNER'),
  getTemplates
);

router.put(
  '/templates/:schoolId',
  authorize('SUPER_ADMIN', 'OWNER'),
  [
    body('type').notEmpty(),
    body('channel').notEmpty(),
    body('body').notEmpty().withMessage('Template body is required'),
  ],
  validate,
  upsertTemplate
);

// ─── Staff: notification log per school ──────────────────
router.get(
  '/school/:schoolId',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'),
  getSchoolNotifications
);

// ─── Staff: send manual notification ─────────────────────
router.post(
  '/send',
  authorize('SUPER_ADMIN', 'OWNER'),
  [body('type').optional(), body('channel').optional()],
  validate,
  sendManualNotification
);

// ─── Super Admin: manual job trigger ─────────────────────
router.post(
  '/trigger-jobs',
  authorize('SUPER_ADMIN'),
  triggerScheduledJobs
);

module.exports = router;
