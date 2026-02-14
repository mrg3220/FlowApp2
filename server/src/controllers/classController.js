const prisma = require('../config/database');

/**
 * POST /api/classes
 * Create a new class (OWNER or INSTRUCTOR)
 */
const createClass = async (req, res, next) => {
  try {
    const { name, discipline, skillLevel, capacity, description, instructorId, schoolId, schedules } = req.body;

    // Determine school — SUPER_ADMIN can specify any school, OWNER uses their school, INSTRUCTOR uses their affiliated school
    let resolvedSchoolId = schoolId;
    if (!resolvedSchoolId) {
      if (req.user.role === 'OWNER') {
        const ownerSchool = await prisma.school.findFirst({ where: { ownerId: req.user.id } });
        resolvedSchoolId = ownerSchool?.id;
      } else if (req.user.role === 'INSTRUCTOR') {
        resolvedSchoolId = req.user.schoolId;
      }
    }

    if (!resolvedSchoolId) {
      return res.status(400).json({ error: 'School ID is required' });
    }

    // If instructor, they can only create classes assigned to themselves
    const assignedInstructor =
      req.user.role === 'INSTRUCTOR' ? req.user.id : instructorId || req.user.id;

    const newClass = await prisma.class.create({
      data: {
        name,
        discipline,
        skillLevel: skillLevel || 'ALL_LEVELS',
        capacity,
        description: description || null,
        instructorId: assignedInstructor,
        schoolId: resolvedSchoolId,
        schedules: schedules
          ? {
              create: schedules.map((s) => ({
                dayOfWeek: s.dayOfWeek,
                startTime: s.startTime,
                endTime: s.endTime,
                effectiveFrom: new Date(s.effectiveFrom),
                effectiveUntil: s.effectiveUntil ? new Date(s.effectiveUntil) : null,
              })),
            }
          : undefined,
      },
      include: {
        instructor: { select: { id: true, firstName: true, lastName: true } },
        school: { select: { id: true, name: true } },
        schedules: true,
      },
    });

    res.status(201).json(newClass);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/classes
 * List all active classes — scoped by role and school
 */
const getClasses = async (req, res, next) => {
  try {
    const { discipline, skillLevel, instructorId, schoolId } = req.query;

    const where = { isActive: true };
    if (discipline) where.discipline = { contains: discipline, mode: 'insensitive' };
    if (skillLevel) where.skillLevel = skillLevel;
    if (instructorId) where.instructorId = instructorId;
    if (schoolId) where.schoolId = schoolId;

    // Scope by role
    if (req.user.role === 'OWNER') {
      const ownerSchools = await prisma.school.findMany({
        where: { ownerId: req.user.id, isActive: true },
        select: { id: true },
      });
      if (!schoolId) {
        where.schoolId = { in: ownerSchools.map((s) => s.id) };
      }
    } else if (req.user.role === 'INSTRUCTOR') {
      if (!schoolId) {
        where.schoolId = req.user.schoolId || 'none';
      }
    }
    // SUPER_ADMIN and STUDENT see all (students can browse)

    const classes = await prisma.class.findMany({
      where,
      include: {
        instructor: { select: { id: true, firstName: true, lastName: true } },
        school: { select: { id: true, name: true } },
        schedules: true,
        _count: { select: { sessions: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json(classes);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/classes/:id
 * Get single class with details
 */
const getClassById = async (req, res, next) => {
  try {
    const cls = await prisma.class.findUnique({
      where: { id: req.params.id },
      include: {
        instructor: { select: { id: true, firstName: true, lastName: true, email: true } },
        school: { select: { id: true, name: true } },
        schedules: true,
        sessions: {
          orderBy: { sessionDate: 'desc' },
          take: 10,
          include: { _count: { select: { checkIns: true } } },
        },
      },
    });

    if (!cls) {
      return res.status(404).json({ error: 'Class not found' });
    }

    res.json(cls);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/classes/:id
 * Update a class
 */
const updateClass = async (req, res, next) => {
  try {
    const { name, discipline, skillLevel, capacity, description, instructorId, isActive } = req.body;

    const updated = await prisma.class.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(discipline !== undefined && { discipline }),
        ...(skillLevel !== undefined && { skillLevel }),
        ...(capacity !== undefined && { capacity }),
        ...(description !== undefined && { description }),
        ...(instructorId !== undefined && { instructorId }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        instructor: { select: { id: true, firstName: true, lastName: true } },
        school: { select: { id: true, name: true } },
        schedules: true,
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/classes/:id
 * Soft-delete (deactivate) a class
 */
const deleteClass = async (req, res, next) => {
  try {
    await prisma.class.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    res.json({ message: 'Class deactivated' });
  } catch (error) {
    next(error);
  }
};

module.exports = { createClass, getClasses, getClassById, updateClass, deleteClass };
