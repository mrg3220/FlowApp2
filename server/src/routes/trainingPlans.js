const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const c = require('../controllers/trainingPlanController');

router.use(authenticate);

router.get('/mine', c.getMyPlans);
router.get('/school/:schoolId', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), c.getPlans);
router.get('/:id', c.getPlan);
router.post('/school/:schoolId', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), c.createPlan);
router.put('/:id', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), c.updatePlan);
router.delete('/:id', authorize('SUPER_ADMIN', 'OWNER'), c.deletePlan);

// Exercises
router.post('/:planId/exercises', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), c.addExercise);
router.put('/exercises/:id', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), c.updateExercise);
router.delete('/exercises/:id', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), c.deleteExercise);

// Assignments
router.post('/:planId/assign', authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'), c.assignPlan);

module.exports = router;
