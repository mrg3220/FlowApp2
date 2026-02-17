const express = require('express');
const { body } = require('express-validator');
const {
  createClass,
  getClasses,
  getClassById,
  updateClass,
  deleteClass,
  addSchedule,
  updateSchedule,
  deleteSchedule,
} = require('../controllers/classController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

router.get('/', getClasses);
router.get('/:id', getClassById);

router.post(
  '/',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'),
  [
    body('name').notEmpty().withMessage('Class name is required'),
    body('discipline').notEmpty().withMessage('Discipline is required'),
    body('capacity').isInt({ min: 1 }).withMessage('Capacity must be at least 1'),
  ],
  validate,
  createClass
);

router.put(
  '/:id',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'),
  updateClass
);

router.delete(
  '/:id',
  authorize('SUPER_ADMIN', 'OWNER'),
  deleteClass
);

// ─── Schedule routes ─────────────────────────────────────
router.post(
  '/:id/schedules',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'),
  [
    body('dayOfWeek').isIn(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']).withMessage('Invalid day of week'),
    body('startTime').matches(/^\d{2}:\d{2}$/).withMessage('Start time must be HH:mm format'),
    body('endTime').matches(/^\d{2}:\d{2}$/).withMessage('End time must be HH:mm format'),
  ],
  validate,
  addSchedule
);

router.put(
  '/:id/schedules/:scheduleId',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'),
  updateSchedule
);

router.delete(
  '/:id/schedules/:scheduleId',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'),
  deleteSchedule
);

module.exports = router;
