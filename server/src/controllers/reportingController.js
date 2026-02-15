const prisma = require('../config/database');

// ─── Revenue Dashboard ───────────────────────────────────

const getRevenueDashboard = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const where = { schoolId: schoolId === 'all' ? undefined : schoolId };
    const paymentWhere = { invoice: where };
    if (startDate || endDate) paymentWhere.paidAt = dateFilter;

    // Total revenue
    const payments = await prisma.payment.aggregate({
      where: { ...paymentWhere },
      _sum: { amount: true },
      _count: true,
    });

    // Outstanding balances
    const outstanding = await prisma.invoice.aggregate({
      where: { ...where, status: { in: ['SENT', 'PAST_DUE'] } },
      _sum: { totalAmount: true },
      _count: true,
    });

    // Revenue by month (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const monthlyPayments = await prisma.payment.findMany({
      where: { ...paymentWhere, paidAt: { gte: twelveMonthsAgo } },
      select: { amount: true, paidAt: true },
    });

    const byMonth = {};
    monthlyPayments.forEach((p) => {
      const key = `${p.paidAt.getFullYear()}-${String(p.paidAt.getMonth() + 1).padStart(2, '0')}`;
      byMonth[key] = (byMonth[key] || 0) + Number(p.amount);
    });

    // Invoice status breakdown
    const invoicesByStatus = await prisma.invoice.groupBy({
      by: ['status'],
      where,
      _count: true,
      _sum: { totalAmount: true },
    });

    // Revenue by plan
    const revenueByPlan = await prisma.invoice.groupBy({
      by: ['planId'],
      where: { ...where, status: 'PAID' },
      _sum: { totalAmount: true },
      _count: true,
    });

    const plans = await prisma.membershipPlan.findMany({
      where: { id: { in: revenueByPlan.map((r) => r.planId).filter(Boolean) } },
      select: { id: true, name: true },
    });
    const planMap = Object.fromEntries(plans.map((p) => [p.id, p.name]));

    // Active subscriptions
    const activeSubscriptions = await prisma.subscription.count({ where: { ...where, status: 'ACTIVE' } });

    res.json({
      totalRevenue: payments._sum.amount || 0,
      totalPayments: payments._count,
      outstandingBalance: outstanding._sum.totalAmount || 0,
      outstandingInvoices: outstanding._count,
      revenueByMonth: byMonth,
      invoicesByStatus: invoicesByStatus.map((s) => ({ status: s.status, count: s._count, amount: s._sum.totalAmount || 0 })),
      revenueByPlan: revenueByPlan.map((r) => ({ planName: planMap[r.planId] || 'No Plan', count: r._count, amount: r._sum.totalAmount || 0 })),
      activeSubscriptions,
    });
  } catch (error) { next(error); }
};

// ─── Revenue by School (multi-school) ────────────────────

const getRevenueBySchool = async (req, res, next) => {
  try {
    const revenueBySchool = await prisma.invoice.groupBy({
      by: ['schoolId'],
      where: { status: 'PAID' },
      _sum: { totalAmount: true },
      _count: true,
    });

    const schools = await prisma.school.findMany({
      where: { id: { in: revenueBySchool.map((r) => r.schoolId) } },
      select: { id: true, name: true },
    });
    const schoolMap = Object.fromEntries(schools.map((s) => [s.id, s.name]));

    res.json(revenueBySchool.map((r) => ({
      schoolId: r.schoolId,
      schoolName: schoolMap[r.schoolId] || 'Unknown',
      revenue: r._sum.totalAmount || 0,
      invoiceCount: r._count,
    })));
  } catch (error) { next(error); }
};

// ─── Payment method breakdown ────────────────────────────

const getPaymentMethodStats = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const where = schoolId === 'all' ? {} : { invoice: { schoolId } };

    const byMethod = await prisma.payment.groupBy({
      by: ['method'],
      where,
      _sum: { amount: true },
      _count: true,
    });

    res.json(byMethod.map((m) => ({ method: m.method, count: m._count, amount: m._sum.amount || 0 })));
  } catch (error) { next(error); }
};

module.exports = { getRevenueDashboard, getRevenueBySchool, getPaymentMethodStats };
