const express = require('express');
const { getStudentPortal, getStudentSchedule } = require('../controllers/studentPortalController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Student self-service dashboard data
router.get('/dashboard', getStudentPortal);

// Student class schedule
router.get('/schedule', getStudentSchedule);

module.exports = router;
