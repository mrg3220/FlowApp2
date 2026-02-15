const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/competitionController');

router.use(authenticate);

router.get('/', c.getCompetitions);
router.get('/student/:studentId/medals', c.getStudentMedalStats);
router.get('/:id', c.getCompetition);
router.post('/', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), c.createCompetition);
router.put('/:id', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), c.updateCompetition);
router.delete('/:id', authorize('SUPER_ADMIN', 'OWNER'), c.deleteCompetition);

// Entries
router.post('/:id/entries', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), c.addEntry);
router.put('/:id/entries/:entryId', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), c.updateEntry);
router.delete('/:id/entries/:entryId', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), c.deleteEntry);

module.exports = router;
