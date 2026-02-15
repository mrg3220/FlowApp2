const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/brandingController');

router.use(authenticate);

// Org branding
router.get('/org', c.getOrgBranding);
router.put('/org', authorize('SUPER_ADMIN', 'MARKETING'), c.upsertOrgBranding);

// School branding
router.get('/school/:schoolId', c.getSchoolBranding);
router.put('/school/:schoolId', authorize('SUPER_ADMIN', 'OWNER', 'SCHOOL_STAFF'), c.upsertSchoolBranding);

module.exports = router;
