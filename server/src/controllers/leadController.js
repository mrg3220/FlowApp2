const prisma = require('../config/database');

// ─── Get all leads for a school ──────────────────────────

const getLeads = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const { status, source, assignedToId, search } = req.query;

    const where = { schoolId };
    if (status) where.status = status;
    if (source) where.source = source;
    if (assignedToId) where.assignedToId = assignedToId;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const leads = await prisma.lead.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { activities: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(leads);
  } catch (error) { next(error); }
};

// ─── Get single lead with activity ──────────────────────

const getLead = async (req, res, next) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        activities: {
          include: { user: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  } catch (error) { next(error); }
};

// ─── Create lead ─────────────────────────────────────────

const createLead = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const lead = await prisma.lead.create({
      data: { schoolId, ...req.body },
      include: { assignedTo: { select: { id: true, firstName: true, lastName: true } } },
    });

    // Auto-create initial activity
    await prisma.leadActivity.create({
      data: { leadId: lead.id, userId: req.user.id, action: 'CREATED', notes: `Lead created from ${lead.source}` },
    });

    res.status(201).json(lead);
  } catch (error) { next(error); }
};

// ─── Update lead ─────────────────────────────────────────

const updateLead = async (req, res, next) => {
  try {
    const existing = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Lead not found' });

    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: req.body,
      include: { assignedTo: { select: { id: true, firstName: true, lastName: true } } },
    });

    // Log status change
    if (req.body.status && req.body.status !== existing.status) {
      await prisma.leadActivity.create({
        data: { leadId: lead.id, userId: req.user.id, action: 'STATUS_CHANGE', notes: `${existing.status} → ${lead.status}` },
      });
    }

    res.json(lead);
  } catch (error) { next(error); }
};

// ─── Add activity to lead ────────────────────────────────

const addActivity = async (req, res, next) => {
  try {
    const activity = await prisma.leadActivity.create({
      data: { leadId: req.params.id, userId: req.user.id, ...req.body },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    res.status(201).json(activity);
  } catch (error) { next(error); }
};

// ─── Conversion funnel stats ─────────────────────────────

const getFunnelStats = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const statuses = ['NEW', 'CONTACTED', 'TRIAL_SCHEDULED', 'TRIAL_COMPLETED', 'CONVERTED', 'LOST'];
    const counts = {};

    for (const status of statuses) {
      counts[status] = await prisma.lead.count({ where: { schoolId, status } });
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const conversionRate = total > 0 ? Math.round((counts.CONVERTED / total) * 100) : 0;

    res.json({ counts, total, conversionRate });
  } catch (error) { next(error); }
};

// ─── Delete lead ─────────────────────────────────────────

const deleteLead = async (req, res, next) => {
  try {
    await prisma.lead.delete({ where: { id: req.params.id } });
    res.json({ message: 'Lead deleted' });
  } catch (error) { next(error); }
};

module.exports = { getLeads, getLead, createLead, updateLead, addActivity, getFunnelStats, deleteLead };
