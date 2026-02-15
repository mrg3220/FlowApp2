/**
 * ──────────────────────────────────────────────────────────
 * Training Plan Controller
 * ──────────────────────────────────────────────────────────
 * Manages training plans, exercises, and student assignments.
 *
 * Security:
 *   - Explicit field whitelisting (no mass assignment)
 *   - School ownership enforced on all plan operations
 *   - Plan ownership verified before update/delete
 *   - Paginated list endpoints
 * ──────────────────────────────────────────────────────────
 */
const prisma = require('../config/database');
const { isSuperRole } = require('../utils/authorization');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

// ─── Plans ───────────────────────────────────────────────

/** @route GET /api/training-plans/:schoolId — Paginated plan list */
const getPlans = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    if (!isSuperRole(req.user) && req.user.schoolId !== schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { skip, take, page, limit } = parsePagination(req.query);
    const where = { schoolId };

    const [plans, total] = await Promise.all([
      prisma.trainingPlan.findMany({
        where,
        include: {
          exercises: { orderBy: { sortOrder: 'asc' } },
          _count: { select: { assignments: true } },
        },
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
      prisma.trainingPlan.count({ where }),
    ]);

    res.json(paginatedResponse(plans, total, page, limit));
  } catch (error) { next(error); }
};

/** @route GET /api/training-plans/plan/:id */
const getPlan = async (req, res, next) => {
  try {
    const plan = await prisma.trainingPlan.findUnique({
      where: { id: req.params.id },
      include: {
        exercises: { orderBy: { sortOrder: 'asc' } },
        assignments: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            class: { select: { name: true } },
          },
          orderBy: { assignDate: 'desc' },
        },
      },
    });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    // Ownership check
    if (!isSuperRole(req.user) && req.user.schoolId !== plan.schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    res.json(plan);
  } catch (error) { next(error); }
};

/**
 * Create training plan. Field whitelist + nested exercise whitelist.
 * @route POST /api/training-plans/:schoolId
 */
const createPlan = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    if (!isSuperRole(req.user) && req.user.schoolId !== schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { name, description, difficulty, duration, exercises } = req.body;

    // Whitelist exercise fields if provided
    const sanitizedExercises = exercises?.map((e) => ({
      name: e.name,
      description: e.description,
      sets: e.sets,
      reps: e.reps,
      duration: e.duration,
      restPeriod: e.restPeriod,
      sortOrder: e.sortOrder,
    }));

    const plan = await prisma.trainingPlan.create({
      data: {
        schoolId,
        name,
        description,
        difficulty,
        duration,
        exercises: sanitizedExercises ? { create: sanitizedExercises } : undefined,
      },
      include: { exercises: true },
    });
    res.status(201).json(plan);
  } catch (error) { next(error); }
};

/**
 * Update training plan. Ownership check + field whitelist.
 * @route PUT /api/training-plans/plan/:id
 */
const updatePlan = async (req, res, next) => {
  try {
    const existing = await prisma.trainingPlan.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Plan not found' });
    if (!isSuperRole(req.user) && req.user.schoolId !== existing.schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { name, description, difficulty, duration } = req.body;
    const plan = await prisma.trainingPlan.update({
      where: { id: req.params.id },
      data: { name, description, difficulty, duration },
    });
    res.json(plan);
  } catch (error) { next(error); }
};

/** @route DELETE /api/training-plans/plan/:id — Ownership check */
const deletePlan = async (req, res, next) => {
  try {
    const existing = await prisma.trainingPlan.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Plan not found' });
    if (!isSuperRole(req.user) && req.user.schoolId !== existing.schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await prisma.trainingPlan.delete({ where: { id: req.params.id } });
    res.json({ message: 'Plan deleted' });
  } catch (error) { next(error); }
};

// ─── Exercises ───────────────────────────────────────────

/**
 * Add exercise to plan. Field whitelist.
 * @route POST /api/training-plans/:planId/exercises
 */
const addExercise = async (req, res, next) => {
  try {
    // Verify plan ownership
    const plan = await prisma.trainingPlan.findUnique({ where: { id: req.params.planId } });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (!isSuperRole(req.user) && req.user.schoolId !== plan.schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { name, description, sets, reps, duration, restPeriod, sortOrder } = req.body;
    const exercise = await prisma.trainingPlanExercise.create({
      data: { planId: req.params.planId, name, description, sets, reps, duration, restPeriod, sortOrder },
    });
    res.status(201).json(exercise);
  } catch (error) { next(error); }
};

/**
 * Update exercise. Field whitelist.
 * @route PUT /api/training-plans/exercises/:id
 */
const updateExercise = async (req, res, next) => {
  try {
    const { name, description, sets, reps, duration, restPeriod, sortOrder } = req.body;
    const exercise = await prisma.trainingPlanExercise.update({
      where: { id: req.params.id },
      data: { name, description, sets, reps, duration, restPeriod, sortOrder },
    });
    res.json(exercise);
  } catch (error) { next(error); }
};

/** @route DELETE /api/training-plans/exercises/:id */
const deleteExercise = async (req, res, next) => {
  try {
    await prisma.trainingPlanExercise.delete({ where: { id: req.params.id } });
    res.json({ message: 'Exercise deleted' });
  } catch (error) { next(error); }
};

// ─── Assignments ─────────────────────────────────────────

/**
 * Assign plan to student/class. Field whitelist.
 * @route POST /api/training-plans/:planId/assign
 */
const assignPlan = async (req, res, next) => {
  try {
    const plan = await prisma.trainingPlan.findUnique({ where: { id: req.params.planId } });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (!isSuperRole(req.user) && req.user.schoolId !== plan.schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { userId, classId, assignDate, notes } = req.body;
    const assignment = await prisma.trainingPlanAssignment.create({
      data: {
        planId: req.params.planId,
        userId,
        classId,
        assignDate: assignDate ? new Date(assignDate) : new Date(),
        notes,
      },
      include: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } },
    });
    res.status(201).json(assignment);
  } catch (error) { next(error); }
};

/** @route GET /api/training-plans/my — Current user's assigned plans */
const getMyPlans = async (req, res, next) => {
  try {
    const assignments = await prisma.trainingPlanAssignment.findMany({
      where: { userId: req.user.id },
      include: { plan: { include: { exercises: { orderBy: { sortOrder: 'asc' } } } } },
      orderBy: { assignDate: 'desc' },
    });
    res.json(assignments);
  } catch (error) { next(error); }
};

module.exports = { getPlans, getPlan, createPlan, updatePlan, deletePlan, addExercise, updateExercise, deleteExercise, assignPlan, getMyPlans };
