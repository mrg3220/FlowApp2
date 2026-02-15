const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const c = require('../controllers/certificationController');

// ─── Validation schemas ──────────────────────────────────
const applicationRules = [
  body('type').trim().notEmpty().withMessage('type is required').isLength({ max: 100 }),
  body('beltLevel').optional().trim().isLength({ max: 50 }),
  body('notes').optional().trim().isLength({ max: 2000 }),
];
const reviewRules = [
  body('status').trim().isIn(['APPROVED', 'DENIED']).withMessage('status must be APPROVED or DENIED'),
  body('reviewNotes').optional().trim().isLength({ max: 2000 }),
];

router.use(authenticate);

router.get('/', c.getApplications);
router.get('/:id', c.getApplication);
router.post('/', applicationRules, validate, c.createApplication);
router.put('/:id', applicationRules, validate, c.updateApplication);
router.post('/:id/submit', c.submitApplication);
router.post('/:id/withdraw', c.withdrawApplication);
router.post('/:id/review', authorize('SUPER_ADMIN', 'OWNER'), reviewRules, validate, c.reviewApplication);
router.post('/:id/mark-paid', authorize('SUPER_ADMIN', 'OWNER'), c.markFeePaid);

module.exports = router;
