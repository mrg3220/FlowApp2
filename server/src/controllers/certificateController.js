/**
 * ──────────────────────────────────────────────────────────
 * Certificate Controller
 * ──────────────────────────────────────────────────────────
 * Manages certificate templates and issued certificates.
 *
 * Security:
 *   - Explicit field whitelisting (no mass assignment)
 *   - School ownership enforced on all operations
 *   - Paginated list endpoints (max 200 per page)
 * ──────────────────────────────────────────────────────────
 */
const prisma = require('../config/database');
const { isSuperRole } = require('../utils/authorization');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

// ─── Templates ───────────────────────────────────────────

/** @route GET /api/certificates/templates/:schoolId? — Paginated */
const getTemplates = async (req, res, next) => {
  try {
    const schoolId = req.params.schoolId || req.query.schoolId;
    if (schoolId && !isSuperRole(req.user) && req.user.schoolId !== schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { skip, take, page, limit } = parsePagination(req.query);
    const where = {};
    if (schoolId) where.schoolId = schoolId;

    const [templates, total] = await Promise.all([
      prisma.certificateTemplate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.certificateTemplate.count({ where }),
    ]);

    res.json(paginatedResponse(templates, total, page, limit));
  } catch (error) { next(error); }
};

/**
 * Create certificate template. Field whitelist prevents mass assignment.
 * @route POST /api/certificates/:schoolId/templates
 */
const createTemplate = async (req, res, next) => {
  try {
    const schoolId = req.params.schoolId || req.body.schoolId;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!isSuperRole(req.user) && req.user.schoolId !== schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { name, description, designConfig, isActive } = req.body;
    const template = await prisma.certificateTemplate.create({
      data: { schoolId, name, description, designConfig, isActive },
    });
    res.status(201).json(template);
  } catch (error) { next(error); }
};

/** @route PUT /api/certificates/templates/:id — Ownership check + field whitelist */
const updateTemplate = async (req, res, next) => {
  try {
    const existing = await prisma.certificateTemplate.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Template not found' });
    if (!isSuperRole(req.user) && req.user.schoolId !== existing.schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { name, description, designConfig, isActive } = req.body;
    const template = await prisma.certificateTemplate.update({
      where: { id: req.params.id },
      data: { name, description, designConfig, isActive },
    });
    res.json(template);
  } catch (error) { next(error); }
};

/** @route DELETE /api/certificates/templates/:id — Ownership check */
const deleteTemplate = async (req, res, next) => {
  try {
    const existing = await prisma.certificateTemplate.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Template not found' });
    if (!isSuperRole(req.user) && req.user.schoolId !== existing.schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await prisma.certificateTemplate.delete({ where: { id: req.params.id } });
    res.json({ message: 'Template deleted' });
  } catch (error) { next(error); }
};

// ─── Certificates ────────────────────────────────────────

/** @route GET /api/certificates — Paginated issued certificates */
const getCertificates = async (req, res, next) => {
  try {
    const schoolId = req.params.schoolId || req.query.schoolId;
    if (schoolId && !isSuperRole(req.user) && req.user.schoolId !== schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { skip, take, page, limit } = parsePagination(req.query);
    // Certificate doesn't have schoolId directly - filter through template relation
    const where = schoolId ? { template: { schoolId } } : {};

    const [certificates, total] = await Promise.all([
      prisma.certificate.findMany({
        where,
        include: {
          template: { select: { id: true, name: true, layoutJson: true } },
          promotion: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.certificate.count({ where }),
    ]);

    // Map to expected frontend shape
    const mapped = certificates.map((c) => ({
      id: c.id,
      studentName: c.studentName,
      beltName: c.beltName,
      programName: c.programName,
      schoolName: c.schoolName,
      issuedDate: c.awardedDate,
      certificateNumber: c.id.slice(0, 8).toUpperCase(),
      pdfUrl: c.pdfUrl,
      template: c.template ? { id: c.template.id, name: c.template.name, layout: c.template.layoutJson } : null,
    }));

    res.json(paginatedResponse(mapped, total, page, limit));
  } catch (error) { next(error); }
};

/**
 * Issue a certificate to a user. Field whitelist.
 * @route POST /api/certificates/:schoolId/issue
 */
const issueCertificate = async (req, res, next) => {
  try {
    const schoolId = req.params.schoolId || req.body.schoolId;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!isSuperRole(req.user) && req.user.schoolId !== schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { templateId, userId, beltRank, notes } = req.body;
    const certificate = await prisma.certificate.create({
      data: { schoolId, templateId, userId, beltRank, notes, issuedAt: new Date(), issuedBy: req.user.id },
      include: { user: { select: { firstName: true, lastName: true } }, template: { select: { name: true } } },
    });
    res.status(201).json(certificate);
  } catch (error) { next(error); }
};

/** @route GET /api/certificates/my — Current user's certificates */
const getMyCertificates = async (req, res, next) => {
  try {
    const certificates = await prisma.certificate.findMany({
      where: { userId: req.user.id },
      include: { template: { select: { name: true, designConfig: true } }, school: { select: { name: true } } },
      orderBy: { issuedAt: 'desc' },
    });
    res.json(certificates);
  } catch (error) { next(error); }
};

module.exports = { getTemplates, createTemplate, updateTemplate, deleteTemplate, getCertificates, issueCertificate, getMyCertificates };
