const express = require('express');
const { body } = require('express-validator');
const { getUsers, getUserById, updateUser } = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// ─── Validation schemas ──────────────────────────────────
const updateUserRules = [
  body('firstName').optional().trim().isLength({ max: 100 }),
  body('lastName').optional().trim().isLength({ max: 100 }),
  body('email').optional().trim().isEmail().normalizeEmail(),
  body('role').optional().trim().isIn([
    'SUPER_ADMIN', 'IT_ADMIN', 'OWNER', 'INSTRUCTOR',
    'STUDENT', 'PARENT', 'SCHOOL_STAFF', 'MARKETING', 'EVENT_COORDINATOR'
  ]).withMessage('invalid role'),
];

router.use(authenticate);

router.get('/', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), getUsers);
router.get('/:id', getUserById);
router.put('/:id', authorize('SUPER_ADMIN', 'OWNER'), updateUserRules, validate, updateUser);

module.exports = router;
