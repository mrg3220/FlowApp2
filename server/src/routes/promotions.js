const express = require('express');
const { body } = require('express-validator');
const {
  getPrograms,
  getProgram,
  createProgram,
  updateProgram,
  createBelt,
  updateBelt,
  deleteBelt,
  createRequirement,
  updateRequirement,
  deleteRequirement,
  getProgramEnrollments,
  createProgramEnrollment,
  getStudentProgress,
  updateProgress,
  promoteStudent,
  getTests,
  createTest,
  updateTest,
  submitEssay,
  reviewEssay,
  getEssays,
} = require('../controllers/promotionController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.use(authenticate);

// ─── Programs ────────────────────────────────────────────
router.get(
  '/programs',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR', 'STUDENT'),
  getPrograms
);

router.get(
  '/programs/:programId',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR', 'STUDENT'),
  getProgram
);

router.post(
  '/programs',
  authorize('SUPER_ADMIN', 'OWNER'),
  [
    body('name').trim().notEmpty().withMessage('Program name is required'),
    body('isGlobal').optional().isBoolean(),
    body('hasRankStructure').optional().isBoolean(),
  ],
  validate,
  createProgram
);

router.put(
  '/programs/:programId',
  authorize('SUPER_ADMIN', 'OWNER'),
  [body('name').optional().trim().notEmpty().withMessage('Name cannot be empty')],
  validate,
  updateProgram
);

// ─── Belts ───────────────────────────────────────────────
router.post(
  '/programs/:programId/belts',
  authorize('SUPER_ADMIN', 'OWNER'),
  [
    body('name').trim().notEmpty().withMessage('Belt name is required'),
    body('displayOrder').isInt({ min: 1 }).withMessage('Display order must be a positive integer'),
    body('color').optional().trim(),
  ],
  validate,
  createBelt
);

router.put(
  '/belts/:beltId',
  authorize('SUPER_ADMIN', 'OWNER'),
  [body('name').optional().trim().notEmpty()],
  validate,
  updateBelt
);

router.delete(
  '/belts/:beltId',
  authorize('SUPER_ADMIN', 'OWNER'),
  deleteBelt
);

// ─── Belt Requirements ───────────────────────────────────
router.post(
  '/belts/:beltId/requirements',
  authorize('SUPER_ADMIN', 'OWNER'),
  [
    body('type').isIn(['MIN_ATTENDANCE', 'TECHNIQUE', 'TIME_IN_RANK', 'MIN_AGE', 'ESSAY', 'CUSTOM']).withMessage('Invalid requirement type'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('value').optional().isFloat({ min: 0 }),
    body('isRequired').optional().isBoolean(),
  ],
  validate,
  createRequirement
);

router.put(
  '/requirements/:requirementId',
  authorize('SUPER_ADMIN', 'OWNER'),
  updateRequirement
);

router.delete(
  '/requirements/:requirementId',
  authorize('SUPER_ADMIN', 'OWNER'),
  deleteRequirement
);

// ─── Program Enrollments ─────────────────────────────────
router.get(
  '/enrollments/:schoolId',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR', 'STUDENT'),
  getProgramEnrollments
);

router.post(
  '/enrollments/:schoolId',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'),
  [
    body('studentId').isUUID().withMessage('Valid student ID is required'),
    body('programId').isUUID().withMessage('Valid program ID is required'),
  ],
  validate,
  createProgramEnrollment
);

// ─── Student Progress ────────────────────────────────────
router.get(
  '/progress/:enrollmentId',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR', 'STUDENT'),
  getStudentProgress
);

router.patch(
  '/progress/:enrollmentId',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'),
  [
    body('requirementId').isUUID().withMessage('Valid requirement ID is required'),
    body('currentValue').isFloat({ min: 0 }).withMessage('Current value must be ≥ 0'),
    body('isComplete').optional().isBoolean(),
  ],
  validate,
  updateProgress
);

// ─── Promotions ──────────────────────────────────────────
router.post(
  '/promote/:enrollmentId',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'),
  [body('notes').optional().trim()],
  validate,
  promoteStudent
);

// ─── Belt Tests ──────────────────────────────────────────
router.get(
  '/tests/:schoolId',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR', 'STUDENT'),
  getTests
);

router.post(
  '/tests',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'),
  [
    body('programEnrollmentId').isUUID().withMessage('Valid enrollment ID is required'),
    body('beltId').isUUID().withMessage('Valid belt ID is required'),
    body('testDate').isISO8601().withMessage('Valid test date is required'),
  ],
  validate,
  createTest
);

router.patch(
  '/tests/:testId',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'),
  [
    body('status').optional().isIn(['SCHEDULED', 'IN_PROGRESS', 'PASSED', 'FAILED']),
    body('score').optional().isFloat({ min: 0, max: 100 }),
  ],
  validate,
  updateTest
);

// ─── Essays ──────────────────────────────────────────────
router.post(
  '/essays',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR', 'STUDENT'),
  [
    body('programEnrollmentId').isUUID().withMessage('Valid enrollment ID is required'),
    body('content').trim().notEmpty().withMessage('Essay content is required'),
    body('title').optional().trim(),
  ],
  validate,
  submitEssay
);

router.get(
  '/essays/:enrollmentId',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR', 'STUDENT'),
  getEssays
);

router.patch(
  '/essays/:essayId/review',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'),
  [
    body('score').optional().isFloat({ min: 0, max: 100 }),
    body('feedback').optional().trim(),
  ],
  validate,
  reviewEssay
);

module.exports = router;
