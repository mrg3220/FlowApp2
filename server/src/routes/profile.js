const express = require('express');
const { getProfile, updateProfile, getUserProfile } = require('../controllers/profileController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', getProfile);
router.put('/', updateProfile);
router.get('/:userId', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), getUserProfile);

module.exports = router;
