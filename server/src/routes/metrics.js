const express = require('express');
const {
  getSuperAdminMetrics,
  getSchoolMetrics,
  getStudentMetrics,
} = require('../controllers/metricsController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/super-admin', authorize('SUPER_ADMIN'), getSuperAdminMetrics);
router.get('/school/:schoolId', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), getSchoolMetrics);
router.get('/student', authorize('STUDENT'), getStudentMetrics);

module.exports = router;
