/**
 * Program Offering Routes
 * 
 * Routes for managing "Programs" (scheduled class offerings).
 * Previously at /api/classes, now at /api/programs
 */

const express = require('express');
const { body } = require('express-validator');
const {
  createProgram,
  getPrograms,
  getProgramById,
  updateProgram,
  deleteProgram,
  addSchedule,
  updateSchedule,
  deleteSchedule,
  getCurricula,
} = require('../controllers/programOfferingController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get available curricula for dropdown
router.get('/curricula', getCurricula);

router.get('/', getPrograms);
router.get('/:id', getProgramById);

router.post(
  '/',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'),
  [
    body('name').notEmpty().withMessage('Program name is required'),
    body('capacity').isInt({ min: 1 }).withMessage('Capacity must be at least 1'),
  ],
  validate,
  createProgram
);

router.put(
  '/:id',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'),
  updateProgram
);

router.delete(
  '/:id',
  authorize('SUPER_ADMIN', 'OWNER'),
  deleteProgram
);

// ─── Schedule routes ─────────────────────────────────────
router.post(
  '/:id/schedules',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'),
  [
    body('dayOfWeek').isIn(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']).withMessage('Invalid day'),
    body('startTime').matches(/^\d{2}:\d{2}$/).withMessage('Start time must be HH:mm'),
    body('endTime').matches(/^\d{2}:\d{2}$/).withMessage('End time must be HH:mm'),
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
  authorize('SUPER_ADMIN', 'OWNER'),
  deleteSchedule
);

module.exports = router;
