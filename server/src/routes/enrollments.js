const express = require('express');
const { body } = require('express-validator');
const {
  enrollStudent,
  transferStudent,
  deactivateEnrollment,
  getEnrollments,
  getSchoolStudents,
} = require('../controllers/enrollmentController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.use(authenticate);

router.get('/', getEnrollments);
router.get('/school/:schoolId/students', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), getSchoolStudents);

router.post(
  '/',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'),
  [
    body('studentId').isUUID().withMessage('Valid student ID is required'),
    body('schoolId').isUUID().withMessage('Valid school ID is required'),
  ],
  validate,
  enrollStudent
);

router.post(
  '/transfer',
  authorize('SUPER_ADMIN', 'OWNER'),
  [
    body('studentId').isUUID().withMessage('Valid student ID is required'),
    body('toSchoolId').isUUID().withMessage('Valid destination school ID is required'),
  ],
  validate,
  transferStudent
);

router.put(
  '/:id/deactivate',
  authorize('SUPER_ADMIN', 'OWNER'),
  deactivateEnrollment
);

module.exports = router;
