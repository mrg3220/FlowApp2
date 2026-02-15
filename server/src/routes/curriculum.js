const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/curriculumController');

router.use(authenticate);

router.get('/', c.getCurriculum);
router.get('/categories', c.getCategories);
router.get('/:id', c.getCurriculumItem);
router.post('/', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), c.createCurriculumItem);
router.put('/:id', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), c.updateCurriculumItem);
router.delete('/:id', authorize('SUPER_ADMIN', 'OWNER'), c.deleteCurriculumItem);

module.exports = router;
