const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/payrollController');

router.use(authenticate);
router.use(authorize('SUPER_ADMIN', 'OWNER'));

router.get('/school/:schoolId', c.getPayrollEntries);
router.get('/summary/:schoolId', c.getPayrollSummary);
router.post('/school/:schoolId', c.createEntry);
router.post('/approve', c.approveEntries);
router.post('/mark-paid', c.markPaid);
router.delete('/:id', c.deleteEntry);

module.exports = router;
