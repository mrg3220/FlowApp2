const express = require('express');
const { body } = require('express-validator');
const {
  createSchool,
  getSchools,
  getSchoolById,
  updateSchool,
  deleteSchool,
} = require('../controllers/schoolController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), getSchools);
router.get('/:id', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), getSchoolById);

router.post(
  '/',
  authorize('SUPER_ADMIN'),
  [
    body('name').notEmpty().withMessage('School name is required'),
    body('ownerId').isUUID().withMessage('Valid owner ID is required'),
  ],
  validate,
  createSchool
);

router.put(
  '/:id',
  authorize('SUPER_ADMIN', 'OWNER'),
  updateSchool
);

router.delete(
  '/:id',
  authorize('SUPER_ADMIN'),
  deleteSchool
);

module.exports = router;
