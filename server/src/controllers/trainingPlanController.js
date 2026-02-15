const prisma = require('../config/database');

const getPlans = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const plans = await prisma.trainingPlan.findMany({
      where: { schoolId },
      include: {
        exercises: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { assignments: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(plans);
  } catch (error) { next(error); }
};

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
    res.json(plan);
  } catch (error) { next(error); }
};

const createPlan = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const { exercises, ...planData } = req.body;
    const plan = await prisma.trainingPlan.create({
      data: {
        schoolId, ...planData,
        exercises: exercises ? { create: exercises } : undefined,
      },
      include: { exercises: true },
    });
    res.status(201).json(plan);
  } catch (error) { next(error); }
};

const updatePlan = async (req, res, next) => {
  try {
    const plan = await prisma.trainingPlan.update({ where: { id: req.params.id }, data: req.body });
    res.json(plan);
  } catch (error) { next(error); }
};

const deletePlan = async (req, res, next) => {
  try {
    await prisma.trainingPlan.delete({ where: { id: req.params.id } });
    res.json({ message: 'Plan deleted' });
  } catch (error) { next(error); }
};

// ─── Exercises ───────────────────────────────────────────

const addExercise = async (req, res, next) => {
  try {
    const exercise = await prisma.trainingPlanExercise.create({
      data: { planId: req.params.planId, ...req.body },
    });
    res.status(201).json(exercise);
  } catch (error) { next(error); }
};

const updateExercise = async (req, res, next) => {
  try {
    const exercise = await prisma.trainingPlanExercise.update({ where: { id: req.params.id }, data: req.body });
    res.json(exercise);
  } catch (error) { next(error); }
};

const deleteExercise = async (req, res, next) => {
  try {
    await prisma.trainingPlanExercise.delete({ where: { id: req.params.id } });
    res.json({ message: 'Exercise deleted' });
  } catch (error) { next(error); }
};

// ─── Assignments ─────────────────────────────────────────

const assignPlan = async (req, res, next) => {
  try {
    const assignment = await prisma.trainingPlanAssignment.create({
      data: { planId: req.params.planId, ...req.body },
      include: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } },
    });
    res.status(201).json(assignment);
  } catch (error) { next(error); }
};

const getMyPlans = async (req, res, next) => {
  try {
    const assignments = await prisma.trainingPlanAssignment.findMany({
      where: { userId: req.user.id },
      include: {
        plan: { include: { exercises: { orderBy: { sortOrder: 'asc' } } } },
      },
      orderBy: { assignDate: 'desc' },
    });
    res.json(assignments);
  } catch (error) { next(error); }
};

module.exports = { getPlans, getPlan, createPlan, updatePlan, deletePlan, addExercise, updateExercise, deleteExercise, assignPlan, getMyPlans };
