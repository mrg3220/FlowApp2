const prisma = require('../config/database');

// ─────────────────────────────────────────────────────────
// Programs — global (Shaolin Wing Chun) + school-specific
// ─────────────────────────────────────────────────────────

/**
 * GET /api/promotions/programs
 * List programs available to a school (global + school-specific).
 * Query: ?schoolId=...
 */
const getPrograms = async (req, res, next) => {
  try {
    const { schoolId } = req.query;

    const where = { isActive: true };
    if (schoolId) {
      where.OR = [
        { isGlobal: true },
        { schoolId },
      ];
    } else if (req.user.role !== 'SUPER_ADMIN') {
      where.OR = [
        { isGlobal: true },
        { schoolId: req.user.schoolId },
      ];
    }

    const programs = await prisma.program.findMany({
      where,
      include: {
        belts: { orderBy: { displayOrder: 'asc' } },
        _count: { select: { enrollments: true } },
      },
      orderBy: [{ isGlobal: 'desc' }, { name: 'asc' }],
    });

    res.json(programs);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/promotions/programs/:programId
 * Get a single program with full belt hierarchy + requirements
 */
const getProgram = async (req, res, next) => {
  try {
    const program = await prisma.program.findUnique({
      where: { id: req.params.programId },
      include: {
        belts: {
          orderBy: { displayOrder: 'asc' },
          include: {
            requirements: true,
            _count: { select: { currentHolders: true } },
          },
        },
        _count: { select: { enrollments: true } },
      },
    });

    if (!program) return res.status(404).json({ error: 'Program not found' });
    res.json(program);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/promotions/programs
 * Create a program. Global programs require SUPER_ADMIN.
 */
const createProgram = async (req, res, next) => {
  try {
    const { name, description, schoolId, isGlobal, hasRankStructure } = req.body;

    // Only SUPER_ADMIN can create global programs
    if (isGlobal && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only Super Admin can create global programs' });
    }

    // OWNER can only create for their school
    if (!isGlobal && req.user.role === 'OWNER') {
      const school = await prisma.school.findUnique({ where: { id: schoolId } });
      if (!school || school.ownerId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const program = await prisma.program.create({
      data: {
        name,
        description: description || null,
        schoolId: isGlobal ? null : schoolId,
        isGlobal: !!isGlobal,
        hasRankStructure: hasRankStructure !== false,
      },
    });

    res.status(201).json(program);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/promotions/programs/:programId
 */
const updateProgram = async (req, res, next) => {
  try {
    const { programId } = req.params;
    const { name, description, hasRankStructure, isActive } = req.body;

    const program = await prisma.program.findUnique({ where: { id: programId } });
    if (!program) return res.status(404).json({ error: 'Program not found' });

    // Only SUPER_ADMIN can edit global programs
    if (program.isGlobal && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only Super Admin can edit global programs' });
    }

    const updated = await prisma.program.update({
      where: { id: programId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(hasRankStructure !== undefined && { hasRankStructure }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────
// Belts — rank hierarchy within a program
// ─────────────────────────────────────────────────────────

/**
 * POST /api/promotions/programs/:programId/belts
 * Add a belt to a program's rank hierarchy.
 */
const createBelt = async (req, res, next) => {
  try {
    const { programId } = req.params;
    const { name, displayOrder, color, description } = req.body;

    const program = await prisma.program.findUnique({ where: { id: programId } });
    if (!program) return res.status(404).json({ error: 'Program not found' });
    if (program.isGlobal && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only Super Admin can manage global program belts' });
    }

    const belt = await prisma.belt.create({
      data: { programId, name, displayOrder, color: color || null, description: description || null },
    });

    res.status(201).json(belt);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'A belt with that order already exists in this program' });
    }
    next(error);
  }
};

/**
 * PUT /api/promotions/belts/:beltId
 */
const updateBelt = async (req, res, next) => {
  try {
    const { beltId } = req.params;
    const { name, displayOrder, color, description } = req.body;

    const belt = await prisma.belt.findUnique({ where: { id: beltId }, include: { program: true } });
    if (!belt) return res.status(404).json({ error: 'Belt not found' });
    if (belt.program.isGlobal && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only Super Admin can manage global program belts' });
    }

    const updated = await prisma.belt.update({
      where: { id: beltId },
      data: {
        ...(name !== undefined && { name }),
        ...(displayOrder !== undefined && { displayOrder }),
        ...(color !== undefined && { color }),
        ...(description !== undefined && { description }),
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/promotions/belts/:beltId
 */
const deleteBelt = async (req, res, next) => {
  try {
    const belt = await prisma.belt.findUnique({ where: { id: req.params.beltId }, include: { program: true } });
    if (!belt) return res.status(404).json({ error: 'Belt not found' });
    if (belt.program.isGlobal && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only Super Admin can manage global program belts' });
    }

    await prisma.belt.delete({ where: { id: req.params.beltId } });
    res.json({ message: 'Belt deleted' });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────
// Belt Requirements — what's needed for each rank
// ─────────────────────────────────────────────────────────

/**
 * POST /api/promotions/belts/:beltId/requirements
 */
const createRequirement = async (req, res, next) => {
  try {
    const { beltId } = req.params;
    const { type, description, value, isRequired } = req.body;

    const belt = await prisma.belt.findUnique({ where: { id: beltId }, include: { program: true } });
    if (!belt) return res.status(404).json({ error: 'Belt not found' });
    if (belt.program.isGlobal && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only Super Admin can manage global program requirements' });
    }

    const requirement = await prisma.beltRequirement.create({
      data: {
        beltId,
        type,
        description,
        value: value != null ? parseFloat(value) : null,
        isRequired: isRequired !== false,
      },
    });

    res.status(201).json(requirement);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/promotions/requirements/:requirementId
 */
const updateRequirement = async (req, res, next) => {
  try {
    const { requirementId } = req.params;
    const { type, description, value, isRequired } = req.body;

    const updated = await prisma.beltRequirement.update({
      where: { id: requirementId },
      data: {
        ...(type !== undefined && { type }),
        ...(description !== undefined && { description }),
        ...(value !== undefined && { value: value != null ? parseFloat(value) : null }),
        ...(isRequired !== undefined && { isRequired }),
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/promotions/requirements/:requirementId
 */
const deleteRequirement = async (req, res, next) => {
  try {
    await prisma.beltRequirement.delete({ where: { id: req.params.requirementId } });
    res.json({ message: 'Requirement deleted' });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────
// Program Enrollments — student ↔ program assignment
// ─────────────────────────────────────────────────────────

/**
 * GET /api/promotions/enrollments/:schoolId
 * List program enrollments for a school
 */
const getProgramEnrollments = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const { programId, studentId } = req.query;

    const where = { schoolId };
    if (programId) where.programId = programId;
    if (req.user.role === 'STUDENT') {
      where.studentId = req.user.id;
    } else if (studentId) {
      where.studentId = studentId;
    }

    const enrollments = await prisma.programEnrollment.findMany({
      where,
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
        program: { select: { id: true, name: true, isGlobal: true, hasRankStructure: true } },
        currentBelt: { select: { id: true, name: true, color: true, displayOrder: true } },
      },
      orderBy: [{ program: { name: 'asc' } }, { student: { lastName: 'asc' } }],
    });

    res.json(enrollments);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/promotions/enrollments/:schoolId
 * Enroll a student in a program at a school
 */
const createProgramEnrollment = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const { studentId, programId } = req.body;

    // Verify student is enrolled at this school
    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId, schoolId, status: 'ACTIVE' },
    });
    if (!enrollment) {
      return res.status(400).json({ error: 'Student is not enrolled at this school' });
    }

    // Verify program is available to this school
    const program = await prisma.program.findFirst({
      where: {
        id: programId,
        isActive: true,
        OR: [{ isGlobal: true }, { schoolId }],
      },
    });
    if (!program) return res.status(404).json({ error: 'Program not available at this school' });

    // Get the first belt (lowest rank) if program has rank structure
    let firstBeltId = null;
    if (program.hasRankStructure) {
      const firstBelt = await prisma.belt.findFirst({
        where: { programId },
        orderBy: { displayOrder: 'asc' },
      });
      if (firstBelt) firstBeltId = firstBelt.id;
    }

    const pe = await prisma.programEnrollment.create({
      data: {
        studentId,
        programId,
        schoolId,
        currentBeltId: firstBeltId,
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
        program: { select: { id: true, name: true } },
        currentBelt: { select: { id: true, name: true, color: true } },
      },
    });

    res.status(201).json(pe);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Student is already enrolled in this program' });
    }
    next(error);
  }
};

// ─────────────────────────────────────────────────────────
// Student Progress — view requirements progress for next belt
// ─────────────────────────────────────────────────────────

/**
 * GET /api/promotions/progress/:enrollmentId
 * Get a student's progress toward their next belt in a program.
 */
const getStudentProgress = async (req, res, next) => {
  try {
    const { enrollmentId } = req.params;

    const pe = await prisma.programEnrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
        program: {
          include: {
            belts: {
              orderBy: { displayOrder: 'asc' },
              include: { requirements: true },
            },
          },
        },
        currentBelt: true,
        progress: { include: { requirement: true } },
        promotions: {
          orderBy: { promotedAt: 'desc' },
          include: {
            fromBelt: { select: { name: true, color: true } },
            toBelt: { select: { name: true, color: true } },
            promotedBy: { select: { firstName: true, lastName: true } },
          },
        },
        essays: {
          orderBy: { submittedAt: 'desc' },
          include: {
            reviewedBy: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!pe) return res.status(404).json({ error: 'Program enrollment not found' });

    // Students can only see their own
    if (req.user.role === 'STUDENT' && pe.studentId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Find next belt
    let nextBelt = null;
    if (pe.currentBelt) {
      nextBelt = pe.program.belts.find(b => b.displayOrder === pe.currentBelt.displayOrder + 1) || null;
    } else if (pe.program.belts.length > 0) {
      nextBelt = pe.program.belts[0];
    }

    // Build progress for next belt requirements
    const requirementProgress = nextBelt ? nextBelt.requirements.map(req => {
      const progress = pe.progress.find(p => p.requirementId === req.id);
      return {
        ...req,
        currentValue: progress?.currentValue || 0,
        isComplete: progress?.isComplete || false,
        completedAt: progress?.completedAt || null,
      };
    }) : [];

    const allComplete = nextBelt && requirementProgress.length > 0
      ? requirementProgress.filter(r => r.isRequired).every(r => r.isComplete)
      : false;

    res.json({
      enrollment: {
        id: pe.id,
        student: pe.student,
        program: { id: pe.program.id, name: pe.program.name, isGlobal: pe.program.isGlobal },
        currentBelt: pe.currentBelt,
        enrolledAt: pe.enrolledAt,
      },
      nextBelt: nextBelt ? { id: nextBelt.id, name: nextBelt.name, color: nextBelt.color, displayOrder: nextBelt.displayOrder } : null,
      requirements: requirementProgress,
      readyForPromotion: allComplete,
      allBelts: pe.program.belts.map(b => ({
        id: b.id, name: b.name, color: b.color, displayOrder: b.displayOrder,
        isCurrent: pe.currentBelt?.id === b.id,
        isAchieved: pe.currentBelt ? b.displayOrder <= pe.currentBelt.displayOrder : false,
      })),
      promotionHistory: pe.promotions,
      essays: pe.essays,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/promotions/progress/:enrollmentId
 * Update requirement progress for a student (Sifu/Instructor only)
 */
const updateProgress = async (req, res, next) => {
  try {
    const { enrollmentId } = req.params;
    const { requirementId, currentValue, isComplete } = req.body;

    const progress = await prisma.requirementProgress.upsert({
      where: {
        programEnrollmentId_requirementId: {
          programEnrollmentId: enrollmentId,
          requirementId,
        },
      },
      create: {
        programEnrollmentId: enrollmentId,
        requirementId,
        currentValue: parseFloat(currentValue),
        isComplete: !!isComplete,
        completedAt: isComplete ? new Date() : null,
      },
      update: {
        currentValue: parseFloat(currentValue),
        isComplete: !!isComplete,
        completedAt: isComplete ? new Date() : null,
      },
    });

    res.json(progress);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────
// Promotions — one-click belt advancement
// ─────────────────────────────────────────────────────────

/**
 * POST /api/promotions/promote/:enrollmentId
 * Promote a student to the next belt (one-click)
 */
const promoteStudent = async (req, res, next) => {
  try {
    const { enrollmentId } = req.params;
    const { toBeltId, notes } = req.body;

    const pe = await prisma.programEnrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        currentBelt: true,
        program: { include: { belts: { orderBy: { displayOrder: 'asc' } } } },
      },
    });

    if (!pe) return res.status(404).json({ error: 'Enrollment not found' });

    // Determine target belt
    let targetBeltId = toBeltId;
    if (!targetBeltId) {
      // Auto-determine: next belt in sequence
      const currentOrder = pe.currentBelt?.displayOrder ?? 0;
      const nextBelt = pe.program.belts.find(b => b.displayOrder === currentOrder + 1);
      if (!nextBelt) return res.status(400).json({ error: 'Student is already at the highest rank' });
      targetBeltId = nextBelt.id;
    }

    // Create promotion record and update enrollment in a transaction
    const [promotion] = await prisma.$transaction([
      prisma.promotion.create({
        data: {
          programEnrollmentId: enrollmentId,
          fromBeltId: pe.currentBeltId,
          toBeltId: targetBeltId,
          promotedById: req.user.id,
          notes: notes || null,
        },
        include: {
          fromBelt: { select: { name: true, color: true } },
          toBelt: { select: { name: true, color: true } },
          promotedBy: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.programEnrollment.update({
        where: { id: enrollmentId },
        data: { currentBeltId: targetBeltId },
      }),
      // Reset progress for the new belt's requirements
      prisma.requirementProgress.deleteMany({
        where: { programEnrollmentId: enrollmentId },
      }),
    ]);

    res.status(201).json(promotion);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────
// Belt Tests — schedule and record test results
// ─────────────────────────────────────────────────────────

/**
 * GET /api/promotions/tests/:schoolId
 */
const getTests = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const { status } = req.query;

    const where = { enrollment: { schoolId } };
    if (status) where.status = status;

    const tests = await prisma.beltTest.findMany({
      where,
      include: {
        enrollment: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
            program: { select: { id: true, name: true } },
          },
        },
        belt: { select: { id: true, name: true, color: true } },
        testedBy: { select: { firstName: true, lastName: true } },
        _count: { select: { essays: true } },
      },
      orderBy: { testDate: 'desc' },
    });

    res.json(tests);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/promotions/tests
 * Schedule a belt test
 */
const createTest = async (req, res, next) => {
  try {
    const { programEnrollmentId, beltId, testDate } = req.body;

    const test = await prisma.beltTest.create({
      data: {
        programEnrollmentId,
        beltId,
        testDate: new Date(testDate),
        testedById: req.user.id,
      },
      include: {
        enrollment: {
          include: {
            student: { select: { firstName: true, lastName: true } },
            program: { select: { name: true } },
          },
        },
        belt: { select: { name: true, color: true } },
      },
    });

    res.status(201).json(test);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/promotions/tests/:testId
 * Update test status/score
 */
const updateTest = async (req, res, next) => {
  try {
    const { testId } = req.params;
    const { status, score, notes } = req.body;

    const updated = await prisma.beltTest.update({
      where: { id: testId },
      data: {
        ...(status !== undefined && { status }),
        ...(score !== undefined && { score: parseFloat(score) }),
        ...(notes !== undefined && { notes }),
        testedById: req.user.id,
      },
    });

    // If passed, auto-promote the student
    if (status === 'PASSED') {
      const test = await prisma.beltTest.findUnique({
        where: { id: testId },
        include: { enrollment: true },
      });

      await prisma.$transaction([
        prisma.promotion.create({
          data: {
            programEnrollmentId: test.programEnrollmentId,
            fromBeltId: test.enrollment.currentBeltId,
            toBeltId: test.beltId,
            promotedById: req.user.id,
            notes: `Passed belt test${score ? ` (score: ${score})` : ''}`,
          },
        }),
        prisma.programEnrollment.update({
          where: { id: test.programEnrollmentId },
          data: { currentBeltId: test.beltId },
        }),
      ]);
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────
// Essays — for Shaolin Wing Chun tests
// ─────────────────────────────────────────────────────────

/**
 * POST /api/promotions/essays
 * Submit an essay (student submits, or staff submits on behalf)
 */
const submitEssay = async (req, res, next) => {
  try {
    const { programEnrollmentId, beltTestId, title, content } = req.body;

    const essay = await prisma.essaySubmission.create({
      data: {
        programEnrollmentId,
        beltTestId: beltTestId || null,
        title: title || null,
        content,
      },
    });

    res.status(201).json(essay);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/promotions/essays/:essayId/review
 * Review/grade an essay (Sifu/Instructor)
 */
const reviewEssay = async (req, res, next) => {
  try {
    const { essayId } = req.params;
    const { score, feedback } = req.body;

    const updated = await prisma.essaySubmission.update({
      where: { id: essayId },
      data: {
        score: score != null ? parseFloat(score) : undefined,
        feedback: feedback || undefined,
        reviewedById: req.user.id,
        reviewedAt: new Date(),
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/promotions/essays/:enrollmentId
 * Get all essays for a program enrollment
 */
const getEssays = async (req, res, next) => {
  try {
    const essays = await prisma.essaySubmission.findMany({
      where: { programEnrollmentId: req.params.enrollmentId },
      include: {
        reviewedBy: { select: { firstName: true, lastName: true } },
        test: { select: { id: true, testDate: true, belt: { select: { name: true } } } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    res.json(essays);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPrograms,
  getProgram,
  createProgram,
  updateProgram,
  createBelt,
  updateBelt,
  deleteBelt,
  createRequirement,
  updateRequirement,
  deleteRequirement,
  getProgramEnrollments,
  createProgramEnrollment,
  getStudentProgress,
  updateProgress,
  promoteStudent,
  getTests,
  createTest,
  updateTest,
  submitEssay,
  reviewEssay,
  getEssays,
};
