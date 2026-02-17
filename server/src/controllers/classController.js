const prisma = require('../config/database');
const { isSuperRole } = require('../utils/authorization');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

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

    const { skip, take, page, limit } = parsePagination(req.query);

    const [classes, total] = await Promise.all([
      prisma.class.findMany({
        where,
        include: {
          instructor: { select: { id: true, firstName: true, lastName: true } },
          school: { select: { id: true, name: true } },
          schedules: true,
          _count: { select: { sessions: true } },
        },
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
      prisma.class.count({ where }),
    ]);

    res.json(paginatedResponse(classes, total, page, limit));
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
    // IDOR check: verify class belongs to user's school
    const existing = await prisma.class.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Class not found' });
    if (!isSuperRole(req.user) && req.user.schoolId !== existing.schoolId && req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

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
    // IDOR check
    const existing = await prisma.class.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Class not found' });
    if (!isSuperRole(req.user) && req.user.schoolId !== existing.schoolId && req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await prisma.class.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    res.json({ message: 'Class deactivated' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/classes/:id/schedules
 * Add a recurring schedule to a class and auto-generate sessions for next 4 weeks
 */
const addSchedule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { dayOfWeek, startTime, endTime, effectiveFrom, effectiveUntil, weeksToGenerate = 4 } = req.body;

    // Verify class exists and user has access
    const cls = await prisma.class.findUnique({ where: { id } });
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    if (!isSuperRole(req.user) && req.user.schoolId !== cls.schoolId && req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const schedule = await prisma.classSchedule.create({
      data: {
        classId: id,
        dayOfWeek,
        startTime,
        endTime,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
        effectiveUntil: effectiveUntil ? new Date(effectiveUntil) : null,
      },
    });

    // Auto-generate sessions for the next X weeks
    const dayMap = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
    const targetDay = dayMap[dayOfWeek];
    const sessionsToCreate = [];
    const startDate = effectiveFrom ? new Date(effectiveFrom) : new Date();
    const endDate = effectiveUntil ? new Date(effectiveUntil) : null;

    // Find the first occurrence of this day of week from start date
    let currentDate = new Date(startDate);
    const currentDayOfWeek = currentDate.getDay();
    const daysUntilTarget = (targetDay - currentDayOfWeek + 7) % 7;
    currentDate.setDate(currentDate.getDate() + (daysUntilTarget === 0 && currentDate >= new Date() ? 0 : daysUntilTarget || 7));

    // Generate sessions for the specified number of weeks
    for (let week = 0; week < weeksToGenerate; week++) {
      const sessionDate = new Date(currentDate);
      sessionDate.setDate(sessionDate.getDate() + (week * 7));

      // Skip if past effectiveUntil
      if (endDate && sessionDate > endDate) break;

      // Skip past dates
      if (sessionDate < new Date().setHours(0, 0, 0, 0)) continue;

      // Generate unique QR code
      const qrCode = `${cls.id}-${sessionDate.toISOString().split('T')[0]}-${schedule.id}`.slice(0, 50);

      sessionsToCreate.push({
        classId: id,
        scheduleId: schedule.id,
        sessionDate,
        startTime,
        endTime,
        status: 'SCHEDULED',
        qrCode,
      });
    }

    // Create all sessions
    if (sessionsToCreate.length > 0) {
      await prisma.classSession.createMany({
        data: sessionsToCreate,
        skipDuplicates: true,
      });
    }

    res.status(201).json({
      schedule,
      sessionsGenerated: sessionsToCreate.length,
      message: `Schedule created with ${sessionsToCreate.length} sessions generated`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/classes/:id/schedules/:scheduleId
 * Update a schedule
 */
const updateSchedule = async (req, res, next) => {
  try {
    const { id, scheduleId } = req.params;
    const { dayOfWeek, startTime, endTime, effectiveFrom, effectiveUntil } = req.body;

    // Verify class
    const cls = await prisma.class.findUnique({ where: { id } });
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    if (!isSuperRole(req.user) && req.user.schoolId !== cls.schoolId && req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const schedule = await prisma.classSchedule.update({
      where: { id: scheduleId },
      data: {
        ...(dayOfWeek && { dayOfWeek }),
        ...(startTime && { startTime }),
        ...(endTime && { endTime }),
        ...(effectiveFrom !== undefined && { effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : null }),
        ...(effectiveUntil !== undefined && { effectiveUntil: effectiveUntil ? new Date(effectiveUntil) : null }),
      },
    });

    res.json(schedule);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/classes/:id/schedules/:scheduleId
 * Remove a schedule
 */
const deleteSchedule = async (req, res, next) => {
  try {
    const { id, scheduleId } = req.params;

    // Verify class
    const cls = await prisma.class.findUnique({ where: { id } });
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    if (!isSuperRole(req.user) && req.user.schoolId !== cls.schoolId && req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await prisma.classSchedule.delete({ where: { id: scheduleId } });
    res.json({ message: 'Schedule deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = { createClass, getClasses, getClassById, updateClass, deleteClass, addSchedule, updateSchedule, deleteSchedule };
