const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const c = require('../controllers/certificateController');

// ─── Validation schemas ──────────────────────────────────
const templateRules = [
  body('name').trim().notEmpty().withMessage('name is required').isLength({ max: 200 }),
  body('description').optional().trim().isLength({ max: 2000 }),
  body('schoolId').optional().isUUID().withMessage('schoolId must be a valid UUID'),
];
const issueRules = [
  body('templateId').isUUID().withMessage('templateId must be a valid UUID'),
  body('userId').isUUID().withMessage('userId must be a valid UUID'),
  body('schoolId').optional().isUUID().withMessage('schoolId must be a valid UUID'),
];

router.use(authenticate);

router.get('/templates/:schoolId?', c.getTemplates);
router.post('/templates', authorize('SUPER_ADMIN', 'OWNER'), templateRules, validate, c.createTemplate);
router.put('/templates/:id', authorize('SUPER_ADMIN', 'OWNER'), templateRules, validate, c.updateTemplate);
router.delete('/templates/:id', authorize('SUPER_ADMIN', 'OWNER'), c.deleteTemplate);
router.get('/', c.getCertificates);
router.post('/generate', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), issueRules, validate, c.issueCertificate);

module.exports = router;
