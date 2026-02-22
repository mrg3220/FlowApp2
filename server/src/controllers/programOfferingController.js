/**
 * Program Controller
 * 
 * Manages "Programs" (scheduled class offerings).
 * Previously known as "Classes" - renamed for clarity.
 * Each program can be linked to a curriculum Program for belt structure.
 */

const prisma = require('../config/database');
const { isSuperRole } = require('../utils/authorization');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

/**
 * POST /api/programs
 * Create a new program offering (OWNER or INSTRUCTOR)
 */
const createProgram = async (req, res, next) => {
  try {
    const { name, programId, skillLevel, capacity, description, instructorId, schoolId, schedules } = req.body;

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

    // If instructor, they can only create programs assigned to themselves
    const assignedInstructor =
      req.user.role === 'INSTRUCTOR' ? req.user.id : instructorId || req.user.id;

    const newProgram = await prisma.class.create({
      data: {
        name,
        programId: programId || null,  // Link to curriculum Program
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
        program: { select: { id: true, name: true } },
        instructor: { select: { id: true, firstName: true, lastName: true } },
        school: { select: { id: true, name: true } },
        schedules: true,
      },
    });

    res.status(201).json(newProgram);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/programs
 * List all active program offerings — scoped by role and school
 */
const getPrograms = async (req, res, next) => {
  try {
    const { programId, skillLevel, instructorId, schoolId } = req.query;

    const where = { isActive: true };
    if (programId) where.programId = programId;
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

    const [programs, total] = await Promise.all([
      prisma.class.findMany({
        where,
        include: {
          program: { select: { id: true, name: true } },
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

    res.json(paginatedResponse(programs, total, page, limit));
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/programs/:id
 * Get single program offering with details
 */
const getProgramById = async (req, res, next) => {
  try {
    const prog = await prisma.class.findUnique({
      where: { id: req.params.id },
      include: {
        program: { 
          select: { 
            id: true, 
            name: true,
            belts: { orderBy: { displayOrder: 'asc' } },
            curriculumItems: true,
          } 
        },
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

    if (!prog) {
      return res.status(404).json({ error: 'Program not found' });
    }

    res.json(prog);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/programs/:id
 * Update a program offering
 */
const updateProgram = async (req, res, next) => {
  try {
    // IDOR check: verify program belongs to user's school
    const existing = await prisma.class.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Program not found' });
    if (!isSuperRole(req.user) && req.user.schoolId !== existing.schoolId && req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { name, programId, skillLevel, capacity, description, instructorId, isActive } = req.body;

    const updated = await prisma.class.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(programId !== undefined && { programId }),
        ...(skillLevel !== undefined && { skillLevel }),
        ...(capacity !== undefined && { capacity }),
        ...(description !== undefined && { description }),
        ...(instructorId !== undefined && { instructorId }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        program: { select: { id: true, name: true } },
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
 * DELETE /api/programs/:id
 * Soft-delete (deactivate) a program offering
 */
const deleteProgram = async (req, res, next) => {
  try {
    // IDOR check
    const existing = await prisma.class.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Program not found' });
    if (!isSuperRole(req.user) && req.user.schoolId !== existing.schoolId && req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await prisma.class.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    res.json({ message: 'Program deactivated' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/programs/:id/schedules
 * Add a recurring schedule to a program and auto-generate classes for next 4 weeks
 */
const addSchedule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { dayOfWeek, startTime, endTime, effectiveFrom, effectiveUntil, weeksToGenerate = 4 } = req.body;

    // Verify program exists and user has access
    const prog = await prisma.class.findUnique({ where: { id } });
    if (!prog) return res.status(404).json({ error: 'Program not found' });
    if (!isSuperRole(req.user) && req.user.schoolId !== prog.schoolId && req.user.role !== 'OWNER') {
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

    // Auto-generate classes for the next X weeks
    const dayMap = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
    const targetDay = dayMap[dayOfWeek];
    const classesToCreate = [];
    const startDate = effectiveFrom ? new Date(effectiveFrom) : new Date();
    const endDate = effectiveUntil ? new Date(effectiveUntil) : null;

    // Find the first occurrence of this day of week from start date
    let currentDate = new Date(startDate);
    const currentDayOfWeek = currentDate.getDay();
    const daysUntilTarget = (targetDay - currentDayOfWeek + 7) % 7;
    currentDate.setDate(currentDate.getDate() + (daysUntilTarget === 0 && currentDate >= new Date() ? 0 : daysUntilTarget || 7));

    // Generate classes for the specified number of weeks
    for (let week = 0; week < weeksToGenerate; week++) {
      const classDate = new Date(currentDate);
      classDate.setDate(classDate.getDate() + (week * 7));

      // Skip if past effectiveUntil
      if (endDate && classDate > endDate) break;

      // Skip past dates
      if (classDate < new Date().setHours(0, 0, 0, 0)) continue;

      // Generate unique QR code
      const qrCode = `${prog.id}-${classDate.toISOString().split('T')[0]}-${schedule.id}`.slice(0, 50);

      classesToCreate.push({
        classId: id,
        scheduleId: schedule.id,
        sessionDate: classDate,
        startTime,
        endTime,
        status: 'SCHEDULED',
        qrCode,
      });
    }

    // Create all classes
    if (classesToCreate.length > 0) {
      await prisma.classSession.createMany({
        data: classesToCreate,
        skipDuplicates: true,
      });
    }

    res.status(201).json({
      schedule,
      classesGenerated: classesToCreate.length,
      message: `Schedule created with ${classesToCreate.length} classes generated`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/programs/:id/schedules/:scheduleId
 * Update a schedule
 */
const updateSchedule = async (req, res, next) => {
  try {
    const { id, scheduleId } = req.params;
    const { dayOfWeek, startTime, endTime, effectiveFrom, effectiveUntil } = req.body;

    // Verify program
    const prog = await prisma.class.findUnique({ where: { id } });
    if (!prog) return res.status(404).json({ error: 'Program not found' });
    if (!isSuperRole(req.user) && req.user.schoolId !== prog.schoolId && req.user.role !== 'OWNER') {
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
 * DELETE /api/programs/:id/schedules/:scheduleId
 * Remove a schedule
 */
const deleteSchedule = async (req, res, next) => {
  try {
    const { id, scheduleId } = req.params;

    // Verify program
    const prog = await prisma.class.findUnique({ where: { id } });
    if (!prog) return res.status(404).json({ error: 'Program not found' });
    if (!isSuperRole(req.user) && req.user.schoolId !== prog.schoolId && req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await prisma.classSchedule.delete({ where: { id: scheduleId } });
    res.json({ message: 'Schedule deleted' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/programs/curricula
 * Get available curriculum programs (for dropdown selection)
 */
const getCurricula = async (req, res, next) => {
  try {
    const { schoolId } = req.query;
    
    // Get global programs + school-specific programs
    const curricula = await prisma.program.findMany({
      where: {
        isActive: true,
        OR: [
          { isGlobal: true },
          { schoolId: schoolId || req.user.schoolId },
        ],
      },
      select: {
        id: true,
        name: true,
        description: true,
        isGlobal: true,
        hasRankStructure: true,
        _count: { select: { belts: true, curriculumItems: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json(curricula);
  } catch (error) {
    next(error);
  }
};

module.exports = { 
  createProgram, 
  getPrograms, 
  getProgramById, 
  updateProgram, 
  deleteProgram, 
  addSchedule, 
  updateSchedule, 
  deleteSchedule,
  getCurricula,
};
