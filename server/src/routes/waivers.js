const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/waiverController');

router.use(authenticate);

// Student
router.get('/mine', c.getMyWaivers);
router.put('/:id/sign', [
  body('signatureData').notEmpty().withMessage('Signature data is required'),
], validate, c.signWaiver);

// Staff
router.get('/templates/:schoolId', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), c.getTemplates);
router.post('/templates/:schoolId', authorize('SUPER_ADMIN', 'OWNER'), [
  body('title').trim().notEmpty().withMessage('Template title is required'),
  body('body').trim().notEmpty().withMessage('Template body is required'),
], validate, c.createTemplate);
router.put('/templates/:id', authorize('SUPER_ADMIN', 'OWNER'), c.updateTemplate);
router.get('/school/:schoolId', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), c.getWaivers);
router.post('/send', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), [
  body('templateId').isUUID().withMessage('Valid templateId required'),
  body('userId').isUUID().withMessage('Valid userId required'),
  body('schoolId').isUUID().withMessage('Valid schoolId required'),
], validate, c.sendWaiver);

module.exports = router;
