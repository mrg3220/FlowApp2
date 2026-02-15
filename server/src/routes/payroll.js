const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/payrollController');

router.use(authenticate);
router.use(authorize('SUPER_ADMIN', 'OWNER'));

router.get('/school/:schoolId', c.getPayrollEntries);
router.get('/summary/:schoolId', c.getPayrollSummary);
router.post('/school/:schoolId', [
  body('instructorId').isUUID().withMessage('Valid instructorId required'),
  body('hoursWorked').isFloat({ min: 0.1 }).withMessage('Hours must be positive'),
  body('hourlyRate').isFloat({ min: 0 }).withMessage('Rate must be non-negative'),
  body('date').isISO8601().withMessage('Valid date required'),
], validate, c.createEntry);
router.post('/approve', [
  body('ids').isArray({ min: 1 }).withMessage('At least one entry ID required'),
  body('ids.*').isUUID(),
], validate, c.approveEntries);
router.post('/mark-paid', [
  body('ids').isArray({ min: 1 }).withMessage('At least one entry ID required'),
  body('ids.*').isUUID(),
], validate, c.markPaid);
router.delete('/:id', c.deleteEntry);

module.exports = router;
