const prisma = require('../config/database');

const getPayrollEntries = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const { instructorId, status, startDate, endDate } = req.query;
    const where = { schoolId };
    if (instructorId) where.instructorId = instructorId;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const entries = await prisma.payrollEntry.findMany({
      where,
      include: {
        instructor: { select: { id: true, firstName: true, lastName: true } },
        session: { select: { sessionDate: true, startTime: true, endTime: true, class: { select: { name: true } } } },
        approvedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { date: 'desc' },
    });
    res.json(entries);
  } catch (error) { next(error); }
};

const createEntry = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const { instructorId, sessionId, hoursWorked, hourlyRate, date, notes } = req.body;
    const totalPay = Math.round(hoursWorked * hourlyRate * 100) / 100;

    const entry = await prisma.payrollEntry.create({
      data: { schoolId, instructorId, sessionId, hoursWorked, hourlyRate, totalPay, date: new Date(date), notes },
      include: { instructor: { select: { firstName: true, lastName: true } } },
    });
    res.status(201).json(entry);
  } catch (error) { next(error); }
};

const approveEntries = async (req, res, next) => {
  try {
    const { ids } = req.body;
    await prisma.payrollEntry.updateMany({
      where: { id: { in: ids }, status: 'PENDING' },
      data: { status: 'APPROVED', approvedById: req.user.id, approvedAt: new Date() },
    });
    res.json({ message: `${ids.length} entries approved` });
  } catch (error) { next(error); }
};

const markPaid = async (req, res, next) => {
  try {
    const { ids } = req.body;
    await prisma.payrollEntry.updateMany({
      where: { id: { in: ids }, status: 'APPROVED' },
      data: { status: 'PAID' },
    });
    res.json({ message: `${ids.length} entries marked paid` });
  } catch (error) { next(error); }
};

const getPayrollSummary = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const { startDate, endDate } = req.query;
    const where = { schoolId };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const summary = await prisma.payrollEntry.groupBy({
      by: ['instructorId', 'status'],
      where,
      _sum: { hoursWorked: true, totalPay: true },
      _count: true,
    });

    const instructors = await prisma.user.findMany({
      where: { id: { in: [...new Set(summary.map((s) => s.instructorId))] } },
      select: { id: true, firstName: true, lastName: true },
    });
    const iMap = Object.fromEntries(instructors.map((i) => [i.id, `${i.firstName} ${i.lastName}`]));

    res.json(summary.map((s) => ({
      instructorId: s.instructorId,
      instructorName: iMap[s.instructorId] || 'Unknown',
      status: s.status,
      totalHours: s._sum.hoursWorked || 0,
      totalPay: s._sum.totalPay || 0,
      entries: s._count,
    })));
  } catch (error) { next(error); }
};

const deleteEntry = async (req, res, next) => {
  try {
    await prisma.payrollEntry.delete({ where: { id: req.params.id } });
    res.json({ message: 'Entry deleted' });
  } catch (error) { next(error); }
};

module.exports = { getPayrollEntries, createEntry, approveEntries, markPaid, getPayrollSummary, deleteEntry };
