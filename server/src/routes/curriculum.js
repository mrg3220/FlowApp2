const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const c = require('../controllers/curriculumController');

// ─── Validation schemas ──────────────────────────────────
const curriculumRules = [
  body('title').trim().notEmpty().withMessage('title is required').isLength({ max: 300 }),
  body('category').optional().trim().isLength({ max: 100 }),
  body('level').optional().trim(),
  body('description').optional().trim().isLength({ max: 5000 }),
];

router.use(authenticate);

router.get('/', c.getCurriculum);
router.get('/categories', c.getCategories);
router.get('/:id', c.getCurriculumItem);
router.post('/', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), curriculumRules, validate, c.createCurriculumItem);
router.put('/:id', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), curriculumRules, validate, c.updateCurriculumItem);
router.delete('/:id', authorize('SUPER_ADMIN', 'OWNER'), c.deleteCurriculumItem);

module.exports = router;
