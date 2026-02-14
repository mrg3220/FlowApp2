const express = require('express');
const { body } = require('express-validator');
const {
  createSession,
  getSessions,
  getSessionById,
  updateSessionStatus,
  getSessionQr,
} = require('../controllers/sessionController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.use(authenticate);

router.get('/', getSessions);
router.get('/:id', getSessionById);
router.get('/:id/qr', getSessionQr);

router.post(
  '/',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'),
  [
    body('classId').isUUID().withMessage('Valid class ID is required'),
    body('sessionDate').isISO8601().withMessage('Valid session date is required'),
    body('startTime').matches(/^\d{2}:\d{2}$/).withMessage('Start time must be HH:mm format'),
    body('endTime').matches(/^\d{2}:\d{2}$/).withMessage('End time must be HH:mm format'),
  ],
  validate,
  createSession
);

router.patch(
  '/:id/status',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'),
  [body('status').isIn(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).withMessage('Invalid status')],
  validate,
  updateSessionStatus
);

module.exports = router;
