const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const c = require('../controllers/virtualController');

// ─── Validation schemas ──────────────────────────────────
const contentRules = [
  body('title').trim().notEmpty().withMessage('title is required').isLength({ max: 300 }),
  body('type').optional().trim().isIn(['VIDEO', 'DOCUMENT', 'ARTICLE', 'LINK']).withMessage('invalid content type'),
  body('url').optional().trim().isURL().withMessage('url must be a valid URL'),
  body('description').optional().trim().isLength({ max: 2000 }),
];

router.use(authenticate);

router.get('/', c.getContent);
router.get('/my-views', c.getMyViews);
router.get('/:id', c.getContentItem);
router.get('/:id/stats', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), c.getContentStats);
router.post('/', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), contentRules, validate, c.createContent);
router.put('/:id', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), contentRules, validate, c.updateContent);
router.delete('/:id', authorize('SUPER_ADMIN', 'OWNER'), c.deleteContent);
router.post('/:id/view', c.recordView);

module.exports = router;
