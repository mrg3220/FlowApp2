const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const c = require('../controllers/competitionController');

// ─── Validation schemas ──────────────────────────────────
const competitionRules = [
  body('name').trim().notEmpty().withMessage('name is required').isLength({ max: 300 }),
  body('date').optional().isISO8601().withMessage('date must be ISO 8601'),
  body('location').optional().trim().isLength({ max: 500 }),
  body('description').optional().trim().isLength({ max: 5000 }),
];
const entryRules = [
  body('userId').isUUID().withMessage('userId must be a valid UUID'),
  body('division').optional().trim().isLength({ max: 100 }),
  body('weightClass').optional().trim().isLength({ max: 50 }),
];

router.use(authenticate);

router.get('/', c.getCompetitions);
router.get('/student/:studentId/medals', c.getStudentMedalStats);
router.get('/:id', c.getCompetition);
router.post('/', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), competitionRules, validate, c.createCompetition);
router.put('/:id', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), competitionRules, validate, c.updateCompetition);
router.delete('/:id', authorize('SUPER_ADMIN', 'OWNER'), c.deleteCompetition);

// Entries
router.post('/:id/entries', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), entryRules, validate, c.addEntry);
router.put('/:id/entries/:entryId', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), c.updateEntry);
router.delete('/:id/entries/:entryId', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), c.deleteEntry);

module.exports = router;
