const prisma = require('../config/database');

/**
 * GET /api/metrics/super-admin
 * High-level metrics across all schools (SUPER_ADMIN only)
 */
const getSuperAdminMetrics = async (req, res, next) => {
  try {
    const today = new Date();
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    // Get all active schools with summary data
    const schools = await prisma.school.findMany({
      where: { isActive: true },
      include: {
        owner: { select: { firstName: true, lastName: true } },
        _count: {
          select: {
            classes: { where: { isActive: true } },
            enrollments: { where: { status: 'ACTIVE' } },
          },
        },
      },
    });

    // Get total check-ins across all schools in last 30 days
    const totalCheckIns30d = await prisma.checkIn.count({
      where: { checkedInAt: { gte: last30Days } },
    });

    const totalCheckIns7d = await prisma.checkIn.count({
      where: { checkedInAt: { gte: last7Days } },
    });

    // Per-school check-in counts (last 30 days)
    const schoolMetrics = await Promise.all(
      schools.map(async (school) => {
        const checkIns = await prisma.checkIn.count({
          where: {
            checkedInAt: { gte: last30Days },
            session: { class: { schoolId: school.id } },
          },
        });

        const checkIns7d = await prisma.checkIn.count({
          where: {
            checkedInAt: { gte: last7Days },
            session: { class: { schoolId: school.id } },
          },
        });

        return {
          id: school.id,
          name: school.name,
          owner: `${school.owner.firstName} ${school.owner.lastName}`,
          activeClasses: school._count.classes,
          activeStudents: school._count.enrollments,
          checkIns30d: checkIns,
          checkIns7d: checkIns7d,
        };
      })
    );

    // Global totals
    const totalStudents = await prisma.enrollment.count({ where: { status: 'ACTIVE' } });
    const totalClasses = await prisma.class.count({ where: { isActive: true } });

    res.json({
      overview: {
        totalSchools: schools.length,
        totalStudents,
        totalClasses,
        totalCheckIns30d,
        totalCheckIns7d,
      },
      schools: schoolMetrics,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/metrics/school/:schoolId
 * Granular metrics for a specific school (OWNER/INSTRUCTOR)
 */
const getSchoolMetrics = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const today = new Date();
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    // Verify access
    if (req.user.role === 'OWNER') {
      const school = await prisma.school.findUnique({ where: { id: schoolId } });
      if (!school || school.ownerId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    } else if (req.user.role === 'INSTRUCTOR' && req.user.schoolId !== schoolId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Active students
    const activeStudents = await prisma.enrollment.count({
      where: { schoolId, status: 'ACTIVE' },
    });

    // Classes and their attendance
    const classes = await prisma.class.findMany({
      where: { schoolId, isActive: true },
      include: {
        instructor: { select: { firstName: true, lastName: true } },
        sessions: {
          where: { sessionDate: { gte: last30Days } },
          include: { _count: { select: { checkIns: true } } },
        },
      },
    });

    const classMetrics = classes.map((cls) => {
      const totalAttendance = cls.sessions.reduce((sum, s) => sum + s._count.checkIns, 0);
      const sessionCount = cls.sessions.length;
      return {
        id: cls.id,
        name: cls.name,
        discipline: cls.discipline,
        instructor: `${cls.instructor.firstName} ${cls.instructor.lastName}`,
        capacity: cls.capacity,
        sessionsLast30d: sessionCount,
        totalAttendanceLast30d: totalAttendance,
        avgAttendance: sessionCount > 0 ? Math.round((totalAttendance / sessionCount) * 10) / 10 : 0,
        utilizationRate: sessionCount > 0
          ? Math.round(((totalAttendance / sessionCount) / cls.capacity) * 100)
          : 0,
      };
    });

    // Total check-ins over time (last 30 days, daily breakdown)
    const checkIns = await prisma.checkIn.findMany({
      where: {
        checkedInAt: { gte: last30Days },
        session: { class: { schoolId } },
      },
      select: { checkedInAt: true },
      orderBy: { checkedInAt: 'asc' },
    });

    // Group by date
    const dailyCheckIns = {};
    for (const ci of checkIns) {
      const date = ci.checkedInAt.toISOString().split('T')[0];
      dailyCheckIns[date] = (dailyCheckIns[date] || 0) + 1;
    }

    // Top students by attendance
    const topStudents = await prisma.checkIn.groupBy({
      by: ['studentId'],
      where: {
        checkedInAt: { gte: last30Days },
        session: { class: { schoolId } },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const topStudentDetails = await Promise.all(
      topStudents.map(async (ts) => {
        const student = await prisma.user.findUnique({
          where: { id: ts.studentId },
          select: { firstName: true, lastName: true, email: true },
        });
        return {
          ...student,
          checkIns: ts._count.id,
        };
      })
    );

    // Recent new enrollments
    const newEnrollments = await prisma.enrollment.count({
      where: {
        schoolId,
        enrolledAt: { gte: last30Days },
      },
    });

    res.json({
      overview: {
        activeStudents,
        activeClasses: classes.length,
        totalCheckIns30d: checkIns.length,
        newEnrollments30d: newEnrollments,
      },
      classes: classMetrics,
      dailyCheckIns,
      topStudents: topStudentDetails,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/metrics/student
 * Personal metrics for the logged-in student
 */
const getStudentMetrics = async (req, res, next) => {
  try {
    const studentId = req.user.id;
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    const last90Days = new Date();
    last90Days.setDate(last90Days.getDate() - 90);

    // Get all check-ins with class info
    const checkIns = await prisma.checkIn.findMany({
      where: { studentId },
      include: {
        session: {
          include: {
            class: { select: { name: true, discipline: true, school: { select: { name: true } } } },
          },
        },
      },
      orderBy: { checkedInAt: 'desc' },
    });

    // Discipline breakdown
    const disciplineMap = {};
    let last30Count = 0;
    let last90Count = 0;

    for (const ci of checkIns) {
      const disc = ci.session.class.discipline;
      if (!disciplineMap[disc]) {
        disciplineMap[disc] = { discipline: disc, count: 0 };
      }
      disciplineMap[disc].count++;
      if (ci.checkedInAt >= last30Days) last30Count++;
      if (ci.checkedInAt >= last90Days) last90Count++;
    }

    // Weekly check-in trend (last 12 weeks)
    const weeklyTrend = [];
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() - i * 7);

      const count = checkIns.filter(
        (ci) => ci.checkedInAt >= weekStart && ci.checkedInAt < weekEnd
      ).length;

      weeklyTrend.push({
        week: weekStart.toISOString().split('T')[0],
        checkIns: count,
      });
    }

    // Current enrollment
    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId, status: 'ACTIVE' },
      include: { school: { select: { id: true, name: true } } },
    });

    // Recent classes (last 10)
    const recentClasses = checkIns.slice(0, 10).map((ci) => ({
      date: ci.checkedInAt,
      className: ci.session.class.name,
      discipline: ci.session.class.discipline,
      school: ci.session.class.school.name,
    }));

    res.json({
      overview: {
        totalCheckIns: checkIns.length,
        last30Days: last30Count,
        last90Days: last90Count,
        weeklyAvg: Math.round((last30Count / 4.3) * 10) / 10,
        currentSchool: enrollment?.school?.name || 'Not enrolled',
      },
      disciplines: Object.values(disciplineMap),
      weeklyTrend,
      recentClasses,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getSuperAdminMetrics, getSchoolMetrics, getStudentMetrics };
