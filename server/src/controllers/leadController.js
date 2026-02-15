/**
 * ──────────────────────────────────────────────────────────
 * Lead Controller
 * ──────────────────────────────────────────────────────────
 * CRUD operations for sales leads and their activities.
 * All endpoints enforce school-level ownership (IDOR prevention).
 *
 * Security:
 *   - Explicit field whitelisting on all create/update (no mass assignment)
 *   - School scope enforced: non-super users see only their school's leads
 *   - SUPER_ADMIN / IT_ADMIN bypass school restrictions
 *   - All list endpoints paginated (max 200 per page)
 * ──────────────────────────────────────────────────────────
 */
const prisma = require('../config/database');
const { isSuperRole } = require('../utils/authorization');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

/**
 * List leads for a school with optional filters and pagination.
 *
 * @route   GET /api/leads/:schoolId
 * @query   status, source, assignedToId, search, page, limit
 * @returns {{ data: Lead[], pagination }}
 * @security School ownership enforced. Super roles bypass.
 */
const getLeads = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    if (!isSuperRole(req.user) && req.user.schoolId !== schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { status, source, assignedToId, search } = req.query;
    const { skip, take, page, limit } = parsePagination(req.query);

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

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { activities: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.lead.count({ where }),
    ]);

    res.json(paginatedResponse(leads, total, page, limit));
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve a single lead and its activity history.
 * @route   GET /api/leads/:schoolId/:id
 * @security School ownership verified via lead lookup.
 */
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
    if (!isSuperRole(req.user) && req.user.schoolId !== lead.schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    res.json(lead);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new lead. Explicit field whitelist prevents mass assignment.
 * @route   POST /api/leads/:schoolId
 * @body    firstName, lastName, email, phone, source, status, assignedToId, trialDate, notes, tags
 */
const createLead = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    if (!isSuperRole(req.user) && req.user.schoolId !== schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Whitelist allowed fields — prevents mass assignment
    const { firstName, lastName, email, phone, source, status,
            assignedToId, trialDate, notes, tags } = req.body;

    const lead = await prisma.lead.create({
      data: {
        schoolId, firstName, lastName, email, phone, source, status,
        assignedToId,
        trialDate: trialDate ? new Date(trialDate) : undefined,
        notes, tags,
      },
      include: { assignedTo: { select: { id: true, firstName: true, lastName: true } } },
    });

    await prisma.leadActivity.create({
      data: { leadId: lead.id, userId: req.user.id, action: 'CREATED', notes: `Lead created from ${lead.source || 'unknown'}` },
    });

    res.status(201).json(lead);
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing lead. Field whitelist enforced.
 * @route   PUT /api/leads/:schoolId/:id
 * @security Ownership verified before update.
 */
const updateLead = async (req, res, next) => {
  try {
    const existing = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Lead not found' });
    if (!isSuperRole(req.user) && req.user.schoolId !== existing.schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { firstName, lastName, email, phone, source, status,
            assignedToId, trialDate, convertedAt, notes, tags } = req.body;

    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: {
        firstName, lastName, email, phone, source, status, assignedToId,
        trialDate: trialDate !== undefined ? (trialDate ? new Date(trialDate) : null) : undefined,
        convertedAt: convertedAt !== undefined ? (convertedAt ? new Date(convertedAt) : null) : undefined,
        notes, tags,
      },
      include: { assignedTo: { select: { id: true, firstName: true, lastName: true } } },
    });

    if (status && status !== existing.status) {
      await prisma.leadActivity.create({
        data: { leadId: lead.id, userId: req.user.id, action: 'STATUS_CHANGE', notes: `${existing.status} → ${lead.status}` },
      });
    }

    res.json(lead);
  } catch (error) {
    next(error);
  }
};

/**
 * Append an activity to a lead's history. Field whitelist enforced.
 * @route   POST /api/leads/:schoolId/:id/activities
 * @body    action, notes
 */
const addActivity = async (req, res, next) => {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (!isSuperRole(req.user) && req.user.schoolId !== lead.schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Only action and notes — prevents mass assignment
    const { action, notes } = req.body;

    const activity = await prisma.leadActivity.create({
      data: { leadId: req.params.id, userId: req.user.id, action, notes },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    res.status(201).json(activity);
  } catch (error) {
    next(error);
  }
};

/**
 * Aggregated funnel stats. Uses groupBy for efficiency (replaces N+1 counts).
 * @route   GET /api/leads/:schoolId/funnel
 */
const getFunnelStats = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    if (!isSuperRole(req.user) && req.user.schoolId !== schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Single groupBy replaces 6 separate count() queries
    const groups = await prisma.lead.groupBy({
      by: ['status'],
      where: { schoolId },
      _count: true,
    });

    const counts = {};
    for (const s of ['NEW', 'CONTACTED', 'TRIAL_SCHEDULED', 'TRIAL_COMPLETED', 'CONVERTED', 'LOST']) {
      counts[s] = 0;
    }
    for (const g of groups) counts[g.status] = g._count;

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const conversionRate = total > 0 ? Math.round((counts.CONVERTED / total) * 100) : 0;

    res.json({ counts, total, conversionRate });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a lead (cascades activities). Ownership verified.
 * @route   DELETE /api/leads/:schoolId/:id
 */
const deleteLead = async (req, res, next) => {
  try {
    const existing = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Lead not found' });
    if (!isSuperRole(req.user) && req.user.schoolId !== existing.schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    await prisma.lead.delete({ where: { id: req.params.id } });
    res.json({ message: 'Lead deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getLeads, getLead, createLead, updateLead, addActivity, getFunnelStats, deleteLead };
