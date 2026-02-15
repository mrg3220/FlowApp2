const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/virtualController');

router.use(authenticate);

router.get('/', c.getContent);
router.get('/my-views', c.getMyViews);
router.get('/:id', c.getContentItem);
router.get('/:id/stats', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), c.getContentStats);
router.post('/', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), c.createContent);
router.put('/:id', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), c.updateContent);
router.delete('/:id', authorize('SUPER_ADMIN', 'OWNER'), c.deleteContent);
router.post('/:id/view', c.recordView);

module.exports = router;
