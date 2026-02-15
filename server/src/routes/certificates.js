const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/certificateController');

router.use(authenticate);

router.get('/templates/:schoolId?', c.getTemplates);
router.post('/templates', authorize('SUPER_ADMIN', 'OWNER'), c.createTemplate);
router.put('/templates/:id', authorize('SUPER_ADMIN', 'OWNER'), c.updateTemplate);
router.delete('/templates/:id', authorize('SUPER_ADMIN', 'OWNER'), c.deleteTemplate);
router.get('/', c.getCertificates);
router.post('/generate', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), c.generateCertificate);

module.exports = router;
