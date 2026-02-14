const express = require('express');
const { body } = require('express-validator');
const {
  checkIn,
  checkInByQr,
  checkInByKiosk,
  removeCheckIn,
  getAttendance,
} = require('../controllers/checkInController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// Manual admin check-in — requires auth
router.post(
  '/',
  authenticate,
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'),
  [
    body('sessionId').isUUID().withMessage('Valid session ID required'),
    body('studentId').isUUID().withMessage('Valid student ID required'),
  ],
  validate,
  checkIn
);

// QR code check-in — requires auth (student scans + is logged in)
router.post(
  '/qr',
  authenticate,
  [
    body('qrCode').notEmpty().withMessage('QR code is required'),
  ],
  validate,
  (req, res, next) => {
    // Auto-fill studentId from the logged-in user
    req.body.studentId = req.user.id;
    next();
  },
  checkInByQr
);

// Kiosk check-in — no auth required (self-service)
router.post(
  '/kiosk',
  [
    body('sessionId').isUUID().withMessage('Valid session ID required'),
    body('email').isEmail().withMessage('Valid email is required'),
  ],
  validate,
  checkInByKiosk
);

// Remove check-in — requires auth
router.delete(
  '/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'),
  removeCheckIn
);

// Attendance report — requires auth
router.get(
  '/attendance/:sessionId',
  authenticate,
  getAttendance
);

module.exports = router;
