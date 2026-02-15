/**
 * ──────────────────────────────────────────────────────────
 * Branding Controller
 * ──────────────────────────────────────────────────────────
 * Manages organisation-level and school-level branding settings.
 *
 * Security:
 *   - Explicit field whitelisting (no mass assignment)
 *   - Org branding: SUPER_ADMIN / IT_ADMIN only
 *   - School branding: school ownership enforced
 * ──────────────────────────────────────────────────────────
 */
const prisma = require('../config/database');
const { isSuperRole } = require('../utils/authorization');

// ─── Allowed-field whitelist ─────────────────────────────
const BRANDING_FIELDS = ['logoUrl', 'primaryColor', 'secondaryColor', 'fontFamily', 'customCss'];

/** Pick only whitelisted keys from an object. */
function pickBrandingFields(body) {
  const data = {};
  for (const key of BRANDING_FIELDS) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  return data;
}

// ─── Organisation Branding ───────────────────────────────

/** @route GET /api/branding/org */
const getOrgBranding = async (req, res, next) => {
  try {
    const branding = await prisma.orgBranding.findFirst();
    res.json(branding || {});
  } catch (error) { next(error); }
};

/**
 * Upsert organisation branding. Super roles only. Field whitelist.
 * @route PUT /api/branding/org
 * @security SUPER_ADMIN, IT_ADMIN
 */
const upsertOrgBranding = async (req, res, next) => {
  try {
    if (!isSuperRole(req.user)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const data = pickBrandingFields(req.body);
    const existing = await prisma.orgBranding.findFirst();

    const branding = existing
      ? await prisma.orgBranding.update({ where: { id: existing.id }, data })
      : await prisma.orgBranding.create({ data });

    res.json(branding);
  } catch (error) { next(error); }
};

// ─── School Branding ─────────────────────────────────────

/** @route GET /api/branding/school/:schoolId */
const getSchoolBranding = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    if (!isSuperRole(req.user) && req.user.schoolId !== schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const branding = await prisma.schoolBranding.findUnique({ where: { schoolId } });
    res.json(branding || {});
  } catch (error) { next(error); }
};

/**
 * Upsert school branding. Ownership enforced. Field whitelist.
 * @route PUT /api/branding/school/:schoolId
 */
const upsertSchoolBranding = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    if (!isSuperRole(req.user) && req.user.schoolId !== schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const data = pickBrandingFields(req.body);
    const branding = await prisma.schoolBranding.upsert({
      where: { schoolId },
      update: data,
      create: { schoolId, ...data },
    });
    res.json(branding);
  } catch (error) { next(error); }
};

module.exports = { getOrgBranding, upsertOrgBranding, getSchoolBranding, upsertSchoolBranding };
