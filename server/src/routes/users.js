const express = require('express');
const { getUsers, getUserById, updateUser } = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), getUsers);
router.get('/:id', getUserById);
router.put('/:id', authorize('SUPER_ADMIN', 'OWNER'), updateUser);

module.exports = router;
