const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const c = require('../controllers/brandingController');

// ─── Validation schemas ──────────────────────────────────
const brandingRules = [
  body('primaryColor').optional().trim().matches(/^#[0-9a-fA-F]{6}$/).withMessage('primaryColor must be a hex color'),
  body('secondaryColor').optional().trim().matches(/^#[0-9a-fA-F]{6}$/).withMessage('secondaryColor must be a hex color'),
  body('logoUrl').optional().trim().isURL().withMessage('logoUrl must be a valid URL'),
  body('schoolName').optional().trim().isLength({ max: 200 }),
];

router.use(authenticate);

// Org branding
router.get('/org', c.getOrgBranding);
router.put('/org', authorize('SUPER_ADMIN', 'MARKETING'), brandingRules, validate, c.upsertOrgBranding);

// School branding
router.get('/school/:schoolId', c.getSchoolBranding);
router.put('/school/:schoolId', authorize('SUPER_ADMIN', 'OWNER', 'SCHOOL_STAFF'), brandingRules, validate, c.upsertSchoolBranding);

module.exports = router;
