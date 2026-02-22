/**
 * Class Instance Routes
 * 
 * Routes for managing "Classes" (individual class meetings).
 * Previously at /api/sessions, now at /api/classes
 */

const express = require('express');
const { body } = require('express-validator');
const {
  createClass,
  getClasses,
  getClassById,
  updateClassStatus,
  getClassQr,
} = require('../controllers/classInstanceController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

router.get('/', getClasses);
router.get('/:id', getClassById);
router.get('/:id/qr', getClassQr);

router.post(
  '/',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'),
  [
    // Support both old field name (classId) and new (programOfferingId)
    body().custom((value, { req }) => {
      if (!req.body.programOfferingId && !req.body.classId) {
        throw new Error('Program offering ID is required');
      }
      return true;
    }),
    body().custom((value, { req }) => {
      if (!req.body.classDate && !req.body.sessionDate) {
        throw new Error('Class date is required');
      }
      return true;
    }),
    body('startTime').matches(/^\d{2}:\d{2}$/).withMessage('Start time must be HH:mm'),
    body('endTime').matches(/^\d{2}:\d{2}$/).withMessage('End time must be HH:mm'),
  ],
  validate,
  createClass
);

router.patch(
  '/:id/status',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'),
  updateClassStatus
);

module.exports = router;
