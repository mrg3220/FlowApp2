const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/waiverController');

router.use(authenticate);

// Student
router.get('/mine', c.getMyWaivers);
router.put('/:id/sign', c.signWaiver);

// Staff
router.get('/templates/:schoolId', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), c.getTemplates);
router.post('/templates/:schoolId', authorize('SUPER_ADMIN', 'OWNER'), c.createTemplate);
router.put('/templates/:id', authorize('SUPER_ADMIN', 'OWNER'), c.updateTemplate);
router.get('/school/:schoolId', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), c.getWaivers);
router.post('/send', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), c.sendWaiver);

module.exports = router;
