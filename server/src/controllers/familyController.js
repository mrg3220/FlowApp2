const prisma = require('../config/database');
const { isSuperRole } = require('../utils/authorization');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

// ─── List families for a school ──────────────────────────

const getFamilies = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const { search } = req.query;
    const { skip, take, page, limit } = parsePagination(req.query);

    // School ownership check
    if (!isSuperRole(req.user) && req.user.schoolId !== schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const where = { schoolId, isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [families, total] = await Promise.all([
      prisma.family.findMany({
        where,
        include: {
          members: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true },
              },
            },
            orderBy: { familyRole: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
      prisma.family.count({ where }),
    ]);

    res.json(paginatedResponse(families, total, page, limit));
  } catch (error) { next(error); }
};

// ─── Get single family ──────────────────────────────────

const getFamily = async (req, res, next) => {
  try {
    const { familyId } = req.params;

    const family = await prisma.family.findUnique({
      where: { id: familyId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true, firstName: true, lastName: true, email: true,
                phone: true, role: true, beltRank: true,
                enrollments: { select: { id: true, school: { select: { name: true } }, status: true } },
                invoices: { where: { status: { in: ['SENT', 'PAST_DUE'] } }, select: { id: true, amount: true, status: true, dueDate: true } },
                subscriptions: { where: { status: 'ACTIVE' }, select: { id: true, plan: { select: { name: true, price: true } } } },
              },
            },
          },
          orderBy: { familyRole: 'asc' },
        },
      },
    });

    if (!family) return res.status(404).json({ error: 'Family not found' });

    // Calculate combined billing summary
    let totalOutstanding = 0;
    let activeSubscriptions = 0;
    for (const m of family.members) {
      for (const inv of m.user.invoices) totalOutstanding += Number(inv.amount);
      activeSubscriptions += m.user.subscriptions.length;
    }

    res.json({ ...family, summary: { totalOutstanding, activeSubscriptions, memberCount: family.members.length } });
  } catch (error) { next(error); }
};

// ─── Create a family ────────────────────────────────────

const createFamily = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const { name, email, phone, notes, primaryUserId } = req.body;

    const family = await prisma.family.create({
      data: {
        name,
        schoolId,
        email,
        phone,
        notes,
        ...(primaryUserId && {
          members: {
            create: { userId: primaryUserId, familyRole: 'PRIMARY' },
          },
        }),
      },
      include: { members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } } },
    });

    res.status(201).json(family);
  } catch (error) { next(error); }
};

// ─── Update a family ────────────────────────────────────

const updateFamily = async (req, res, next) => {
  try {
    const { familyId } = req.params;
    const { name, email, phone, notes, isActive } = req.body;

    const family = await prisma.family.update({
      where: { id: familyId },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(notes !== undefined && { notes }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } } },
    });

    res.json(family);
  } catch (error) { next(error); }
};

// ─── Add member to family ───────────────────────────────

const addMember = async (req, res, next) => {
  try {
    const { familyId } = req.params;
    const { userId, familyRole = 'CHILD' } = req.body;

    const member = await prisma.familyMember.create({
      data: { familyId, userId, familyRole },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } },
    });

    res.status(201).json(member);
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'User is already in this family' });
    next(error);
  }
};

// ─── Update member role ─────────────────────────────────

const updateMember = async (req, res, next) => {
  try {
    const { memberId } = req.params;
    const { familyRole } = req.body;

    const member = await prisma.familyMember.update({
      where: { id: memberId },
      data: { familyRole },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });

    res.json(member);
  } catch (error) { next(error); }
};

// ─── Remove member from family ──────────────────────────

const removeMember = async (req, res, next) => {
  try {
    const { memberId } = req.params;
    await prisma.familyMember.delete({ where: { id: memberId } });
    res.json({ message: 'Member removed from family' });
  } catch (error) { next(error); }
};

// ─── Get families for current user ──────────────────────

const getMyFamilies = async (req, res, next) => {
  try {
    const memberships = await prisma.familyMember.findMany({
      where: { userId: req.user.id },
      include: {
        family: {
          include: {
            members: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
              },
              orderBy: { familyRole: 'asc' },
            },
          },
        },
      },
    });

    res.json(memberships.map((m) => ({ ...m.family, myRole: m.familyRole })));
  } catch (error) { next(error); }
};

// ─── Combined billing for a family ──────────────────────

const getFamilyBilling = async (req, res, next) => {
  try {
    const { familyId } = req.params;

    const family = await prisma.family.findUnique({
      where: { id: familyId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true, firstName: true, lastName: true,
                invoices: { orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, amount: true, status: true, dueDate: true, description: true, createdAt: true } },
                subscriptions: { select: { id: true, status: true, plan: { select: { name: true, price: true, interval: true } } } },
                payments: { orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, amount: true, method: true, createdAt: true } },
              },
            },
          },
        },
      },
    });

    if (!family) return res.status(404).json({ error: 'Family not found' });

    // Flatten and aggregate
    const allInvoices = [];
    const allSubscriptions = [];
    const allPayments = [];
    let totalOwed = 0;
    let totalPaid = 0;

    for (const m of family.members) {
      for (const inv of m.user.invoices) {
        allInvoices.push({ ...inv, memberName: `${m.user.firstName} ${m.user.lastName}` });
        if (inv.status === 'SENT' || inv.status === 'PAST_DUE') totalOwed += Number(inv.amount);
      }
      for (const sub of m.user.subscriptions) {
        allSubscriptions.push({ ...sub, memberName: `${m.user.firstName} ${m.user.lastName}` });
      }
      for (const pay of m.user.payments) {
        allPayments.push({ ...pay, memberName: `${m.user.firstName} ${m.user.lastName}` });
        totalPaid += Number(pay.amount);
      }
    }

    res.json({
      familyName: family.name,
      invoices: allInvoices,
      subscriptions: allSubscriptions,
      payments: allPayments,
      summary: { totalOwed, totalPaid, memberCount: family.members.length },
    });
  } catch (error) { next(error); }
};

module.exports = {
  getFamilies,
  getFamily,
  createFamily,
  updateFamily,
  addMember,
  updateMember,
  removeMember,
  getMyFamilies,
  getFamilyBilling,
};
