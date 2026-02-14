const prisma = require('../config/database');

/**
 * POST /api/enrollments
 * Enroll a student at a school
 */
const enrollStudent = async (req, res, next) => {
  try {
    const { studentId, schoolId } = req.body;

    // Validate student exists
    const student = await prisma.user.findUnique({ where: { id: studentId } });
    if (!student || student.role !== 'STUDENT') {
      return res.status(400).json({ error: 'Valid student is required' });
    }

    // Validate school exists
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school || !school.isActive) {
      return res.status(404).json({ error: 'School not found or inactive' });
    }

    // Check if student already has an active enrollment anywhere
    const activeEnrollment = await prisma.enrollment.findFirst({
      where: { studentId, status: 'ACTIVE' },
      include: { school: { select: { name: true } } },
    });

    if (activeEnrollment) {
      if (activeEnrollment.schoolId === schoolId) {
        return res.status(409).json({ error: 'Student is already enrolled at this school' });
      }
      return res.status(409).json({
        error: `Student is currently enrolled at ${activeEnrollment.school.name}. Transfer them first.`,
        currentEnrollment: activeEnrollment,
      });
    }

    const enrollment = await prisma.enrollment.create({
      data: { studentId, schoolId },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
        school: { select: { id: true, name: true } },
      },
    });

    res.status(201).json(enrollment);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/enrollments/transfer
 * Transfer a student from one school to another
 */
const transferStudent = async (req, res, next) => {
  try {
    const { studentId, toSchoolId } = req.body;

    // Find current active enrollment
    const currentEnrollment = await prisma.enrollment.findFirst({
      where: { studentId, status: 'ACTIVE' },
    });

    if (!currentEnrollment) {
      return res.status(400).json({ error: 'Student has no active enrollment to transfer from' });
    }

    if (currentEnrollment.schoolId === toSchoolId) {
      return res.status(400).json({ error: 'Student is already enrolled at this school' });
    }

    // Validate destination school
    const toSchool = await prisma.school.findUnique({ where: { id: toSchoolId } });
    if (!toSchool || !toSchool.isActive) {
      return res.status(404).json({ error: 'Destination school not found or inactive' });
    }

    // Transaction: deactivate old enrollment, create new one
    const [_, newEnrollment] = await prisma.$transaction([
      prisma.enrollment.update({
        where: { id: currentEnrollment.id },
        data: { status: 'TRANSFERRED', leftAt: new Date() },
      }),
      prisma.enrollment.create({
        data: { studentId, schoolId: toSchoolId },
        include: {
          student: { select: { id: true, firstName: true, lastName: true, email: true } },
          school: { select: { id: true, name: true } },
        },
      }),
    ]);

    res.json({ message: 'Student transferred successfully', enrollment: newEnrollment });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/enrollments/:id/deactivate
 * Deactivate an enrollment (student leaves school)
 */
const deactivateEnrollment = async (req, res, next) => {
  try {
    const enrollment = await prisma.enrollment.update({
      where: { id: req.params.id },
      data: { status: 'INACTIVE', leftAt: new Date() },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
        school: { select: { id: true, name: true } },
      },
    });

    res.json({ message: 'Enrollment deactivated', enrollment });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/enrollments
 * List enrollments — filtered by schoolId or studentId
 */
const getEnrollments = async (req, res, next) => {
  try {
    const { schoolId, studentId, status } = req.query;

    const where = {};
    if (schoolId) where.schoolId = schoolId;
    if (studentId) where.studentId = studentId;
    if (status) where.status = status;

    // Scope for non-super-admin
    if (req.user.role === 'OWNER') {
      const ownerSchools = await prisma.school.findMany({
        where: { ownerId: req.user.id },
        select: { id: true },
      });
      where.schoolId = { in: ownerSchools.map((s) => s.id) };
    } else if (req.user.role === 'INSTRUCTOR') {
      if (!req.user.schoolId) return res.json([]);
      where.schoolId = req.user.schoolId;
    } else if (req.user.role === 'STUDENT') {
      where.studentId = req.user.id;
    }

    const enrollments = await prisma.enrollment.findMany({
      where,
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
        school: { select: { id: true, name: true } },
      },
      orderBy: { enrolledAt: 'desc' },
    });

    res.json(enrollments);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/enrollments/school/:schoolId/students
 * Get all active students enrolled at a school
 */
const getSchoolStudents = async (req, res, next) => {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: {
        schoolId: req.params.schoolId,
        status: 'ACTIVE',
      },
      include: {
        student: {
          select: {
            id: true, firstName: true, lastName: true, email: true, phone: true,
            beltRank: true, createdAt: true,
            _count: { select: { checkIns: true } },
          },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    });

    res.json(enrollments.map((e) => ({
      enrollmentId: e.id,
      enrolledAt: e.enrolledAt,
      ...e.student,
    })));
  } catch (error) {
    next(error);
  }
};

module.exports = { enrollStudent, transferStudent, deactivateEnrollment, getEnrollments, getSchoolStudents };
