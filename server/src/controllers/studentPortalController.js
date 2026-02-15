const prisma = require('../config/database');

// ─── Student Dashboard (self-service) ────────────────────

const getStudentPortal = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [user, enrollments, checkIns, invoices, payments, subscriptions, programEnrollments, notifications, familyMemberships] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, beltRank: true, dateOfBirth: true, createdAt: true },
      }),
      prisma.enrollment.findMany({
        where: { studentId: userId, status: 'ACTIVE' },
        include: { school: { select: { id: true, name: true } } },
      }),
      prisma.checkIn.findMany({
        where: { studentId: userId },
        include: { session: { include: { class: { select: { name: true } } } } },
        orderBy: { checkedInAt: 'desc' },
        take: 50,
      }),
      prisma.invoice.findMany({
        where: { studentId: userId },
        include: { school: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.payment.findMany({
        where: { studentId: userId },
        include: { invoice: { select: { invoiceNumber: true, notes: true } } },
        orderBy: { paidAt: 'desc' },
        take: 30,
      }),
      prisma.subscription.findMany({
        where: { studentId: userId, status: 'ACTIVE' },
        include: { plan: { select: { name: true, price: true, billingCycle: true } }, school: { select: { name: true } } },
      }),
      prisma.programEnrollment.findMany({
        where: { studentId: userId },
        include: {
          program: { select: { id: true, name: true, description: true } },
          currentBelt: { select: { id: true, name: true, color: true, displayOrder: true } },
          school: { select: { name: true } },
          progress: { include: { requirement: { select: { description: true, type: true } } } },
          promotions: { orderBy: { promotedAt: 'desc' }, take: 10, include: { fromBelt: { select: { name: true, color: true } }, toBelt: { select: { name: true, color: true } } } },
        },
      }),
      prisma.notification.findMany({
        where: { userId, readAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.familyMember.findMany({
        where: { userId },
        include: {
          family: {
            include: { members: { include: { user: { select: { id: true, firstName: true, lastName: true } } } } },
          },
        },
      }),
    ]);

    // Attendance stats
    const totalCheckIns = await prisma.checkIn.count({ where: { studentId: userId } });
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentCheckIns = await prisma.checkIn.count({
      where: { studentId: userId, checkedInAt: { gte: thirtyDaysAgo } },
    });

    // Billing summary
    const outstandingBalance = invoices
      .filter((i) => i.status === 'SENT' || i.status === 'PAST_DUE')
      .reduce((sum, i) => sum + Number(i.totalAmount), 0);

    // Belt progress per program
    const beltProgress = programEnrollments.map((pe) => {
      const totalReqs = pe.progress.length;
      const completedReqs = pe.progress.filter((p) => p.isComplete).length;
      return {
        programName: pe.program.name,
        schoolName: pe.school.name,
        currentBelt: pe.currentBelt,
        requirements: pe.progress,
        promotionHistory: pe.promotions,
        completedRequirements: completedReqs,
        totalRequirements: totalReqs,
        progressPercent: totalReqs > 0 ? Math.round((completedReqs / totalReqs) * 100) : 0,
      };
    });

    // Upcoming sessions for enrolled schools
    const schoolIds = enrollments.map((e) => e.schoolId);
    const upcomingSessions = await prisma.classSession.findMany({
      where: {
        class: { schoolId: { in: schoolIds } },
        sessionDate: { gte: new Date() },
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
      },
      include: { class: { select: { name: true, school: { select: { name: true } } } } },
      orderBy: { sessionDate: 'asc' },
      take: 10,
    });

    res.json({
      profile: user,
      enrollments,
      attendance: {
        recent: checkIns,
        totalCheckIns,
        last30Days: recentCheckIns,
      },
      billing: {
        invoices,
        payments,
        subscriptions,
        outstandingBalance,
      },
      beltProgress,
      upcomingSessions,
      unreadNotifications: notifications,
      family: familyMemberships.map((m) => ({ ...m.family, myRole: m.familyRole })),
    });
  } catch (error) { next(error); }
};

// ─── Get class schedule for a student ────────────────────

const getStudentSchedule = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: userId, status: 'ACTIVE' },
    });
    const schoolIds = enrollments.map((e) => e.schoolId);

    const where = {
      class: { schoolId: { in: schoolIds } },
      status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
    };

    if (startDate) where.sessionDate = { ...where.sessionDate, gte: new Date(startDate) };
    if (endDate) where.sessionDate = { ...where.sessionDate, lte: new Date(endDate) };
    if (!startDate && !endDate) where.sessionDate = { gte: new Date() };

    const sessions = await prisma.classSession.findMany({
      where,
      include: {
        class: { select: { name: true, school: { select: { name: true } }, instructor: { select: { firstName: true, lastName: true } } } },
        checkIns: { where: { studentId: userId }, select: { id: true } },
      },
      orderBy: { sessionDate: 'asc' },
      take: 50,
    });

    res.json(sessions.map((s) => ({
      ...s,
      attended: s.checkIns.length > 0,
    })));
  } catch (error) { next(error); }
};

module.exports = { getStudentPortal, getStudentSchedule };
