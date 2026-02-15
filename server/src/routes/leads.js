const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { getLeads, getLead, createLead, updateLead, addActivity, getFunnelStats, deleteLead } = require('../controllers/leadController');

router.use(authenticate);

router.get('/school/:schoolId', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), getLeads);
router.get('/school/:schoolId/funnel', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), getFunnelStats);
router.get('/:id', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), getLead);
router.post('/school/:schoolId', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').optional().isEmail().normalizeEmail(),
], validate, createLead);
router.put('/:id', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), updateLead);
router.post('/:id/activity', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), [
  body('type').trim().notEmpty().withMessage('Activity type is required'),
], validate, addActivity);
router.delete('/:id', authorize('SUPER_ADMIN', 'OWNER'), deleteLead);

module.exports = router;
