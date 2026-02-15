const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/certificationController');

router.use(authenticate);

router.get('/', c.getApplications);
router.get('/:id', c.getApplication);
router.post('/', c.createApplication);
router.put('/:id', c.updateApplication);
router.post('/:id/submit', c.submitApplication);
router.post('/:id/withdraw', c.withdrawApplication);
router.post('/:id/review', authorize('SUPER_ADMIN', 'OWNER'), c.reviewApplication);
router.post('/:id/mark-paid', authorize('SUPER_ADMIN', 'OWNER'), c.markFeePaid);

module.exports = router;
