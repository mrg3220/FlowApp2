const express = require('express');
const { body } = require('express-validator');
const {
  createClass,
  getClasses,
  getClassById,
  updateClass,
  deleteClass,
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

module.exports = router;
