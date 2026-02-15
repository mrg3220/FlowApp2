const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/reportingController');

router.use(authenticate);
router.use(authorize('SUPER_ADMIN', 'OWNER'));

router.get('/revenue/:schoolId', c.getRevenueDashboard);
router.get('/revenue-by-school', c.getRevenueBySchool);
router.get('/payment-methods/:schoolId', c.getPaymentMethodStats);

module.exports = router;
