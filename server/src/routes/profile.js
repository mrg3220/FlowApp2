const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { getProfile, updateProfile, getUserProfile } = require('../controllers/profileController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', getProfile);
router.put('/', [
  body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
  body('newPassword').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
], validate, updateProfile);
router.get('/:userId', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), getUserProfile);

module.exports = router;
