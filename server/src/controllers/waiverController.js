/**
 * ──────────────────────────────────────────────────────────
 * Waiver Controller
 * ──────────────────────────────────────────────────────────
 * Manages waiver templates and individual waiver signing.
 *
 * Security:
 *   - Explicit field whitelisting (no mass assignment)
 *   - School ownership enforced on templates and waivers
 *   - signWaiver: users can only sign their OWN waivers (IDOR fix)
 *   - IP address captured for audit trail on signatures
 *   - Paginated list endpoints (max 200 per page)
 * ──────────────────────────────────────────────────────────
 */
const prisma = require('../config/database');
const { isSuperRole } = require('../utils/authorization');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

// ─── Waiver Templates ────────────────────────────────────

/** @route GET /api/waivers/:schoolId/templates */
const getTemplates = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    if (!isSuperRole(req.user) && req.user.schoolId !== schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const templates = await prisma.waiverTemplate.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { waivers: true } } },
    });
    res.json(templates);
  } catch (error) { next(error); }
};

/**
 * Create waiver template. Field whitelist prevents mass assignment.
 * @route POST /api/waivers/:schoolId/templates
 */
const createTemplate = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    if (!isSuperRole(req.user) && req.user.schoolId !== schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Whitelist allowed fields
    const { title, body, isRequired } = req.body;

    const template = await prisma.waiverTemplate.create({
      data: { schoolId, title, body, isRequired },
    });
    res.status(201).json(template);
  } catch (error) { next(error); }
};

/** @route PUT /api/waivers/templates/:id — Ownership check + field whitelist */
const updateTemplate = async (req, res, next) => {
  try {
    const existing = await prisma.waiverTemplate.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Template not found' });
    if (!isSuperRole(req.user) && req.user.schoolId !== existing.schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { title, body, isRequired } = req.body;
    const template = await prisma.waiverTemplate.update({
      where: { id: req.params.id },
      data: { title, body, isRequired },
    });
    res.json(template);
  } catch (error) { next(error); }
};

// ─── Waivers ─────────────────────────────────────────────

/** @route GET /api/waivers/:schoolId — Paginated waiver list */
const getWaivers = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    if (!isSuperRole(req.user) && req.user.schoolId !== schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { status, userId } = req.query;
    const { skip, take, page, limit } = parsePagination(req.query);
    const where = { schoolId };
    if (status) where.status = status;
    if (userId) where.userId = userId;

    const [waivers, total] = await Promise.all([
      prisma.waiver.findMany({
        where,
        include: {
          template: { select: { title: true } },
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.waiver.count({ where }),
    ]);

    res.json(paginatedResponse(waivers, total, page, limit));
  } catch (error) { next(error); }
};

/** @route GET /api/waivers/my — Current user's waivers */
const getMyWaivers = async (req, res, next) => {
  try {
    const waivers = await prisma.waiver.findMany({
      where: { userId: req.user.id },
      include: { template: { select: { title: true, body: true } }, school: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(waivers);
  } catch (error) { next(error); }
};

/**
 * Send (create) a waiver for a user. Field whitelist.
 * @route POST /api/waivers/send
 */
const sendWaiver = async (req, res, next) => {
  try {
    const { templateId, schoolId, userId } = req.body;

    // Ownership: non-super users can only send waivers for their school
    if (!isSuperRole(req.user) && req.user.schoolId !== schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const waiver = await prisma.waiver.create({
      data: { templateId, schoolId, userId, status: 'PENDING' },
      include: { template: { select: { title: true } }, user: { select: { firstName: true, lastName: true } } },
    });
    res.status(201).json(waiver);
  } catch (error) { next(error); }
};

/**
 * Sign a waiver. CRITICAL IDOR FIX: users can ONLY sign their own waivers.
 * The waiver's userId must match the authenticated user.
 *
 * @route PUT /api/waivers/:id/sign
 * @body  signatureData — base64 signature image (PII: treat accordingly)
 * @security IDOR prevention: waiver.userId === req.user.id
 */
const signWaiver = async (req, res, next) => {
  try {
    // Fetch first to enforce ownership (IDOR prevention)
    const existing = await prisma.waiver.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Waiver not found' });

    // CRITICAL: users can only sign their OWN waivers
    if (existing.userId !== req.user.id && !isSuperRole(req.user)) {
      return res.status(403).json({ error: 'You can only sign your own waivers' });
    }

    if (existing.status === 'SIGNED') {
      return res.status(400).json({ error: 'Waiver already signed' });
    }

    const waiver = await prisma.waiver.update({
      where: { id: req.params.id },
      data: {
        status: 'SIGNED',
        signedAt: new Date(),
        signatureData: req.body.signatureData,
        ipAddress: req.ip,   // Audit trail for legal compliance
      },
    });
    res.json(waiver);
  } catch (error) { next(error); }
};

module.exports = { getTemplates, createTemplate, updateTemplate, getWaivers, getMyWaivers, sendWaiver, signWaiver };
