const prisma = require('../config/database');

// ─── Org Branding (SUPER_ADMIN / MARKETING) ──────────────

const getOrgBranding = async (req, res, next) => {
  try {
    let branding = await prisma.orgBranding.findFirst();
    if (!branding) {
      // Return defaults
      branding = {
        id: null,
        logoUrl: null,
        logoLightUrl: null,
        primaryColor: '#1a1a2e',
        secondaryColor: '#e94560',
        accentColor: '#0f3460',
        fontFamily: 'Inter, sans-serif',
        tagline: null,
        guidelines: null,
      };
    }
    res.json(branding);
  } catch (error) { next(error); }
};

const upsertOrgBranding = async (req, res, next) => {
  try {
    const existing = await prisma.orgBranding.findFirst();
    let branding;
    if (existing) {
      branding = await prisma.orgBranding.update({ where: { id: existing.id }, data: req.body });
    } else {
      branding = await prisma.orgBranding.create({ data: req.body });
    }
    res.json(branding);
  } catch (error) { next(error); }
};

// ─── School Branding (OWNER / SCHOOL_STAFF) ──────────────

const getSchoolBranding = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    let branding = await prisma.schoolBranding.findUnique({ where: { schoolId } });
    if (!branding) {
      branding = {
        id: null, schoolId,
        logoUrl: null, bannerUrl: null,
        primaryColor: null, secondaryColor: null,
        description: null, welcomeMessage: null,
      };
    }
    res.json(branding);
  } catch (error) { next(error); }
};

const upsertSchoolBranding = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const branding = await prisma.schoolBranding.upsert({
      where: { schoolId },
      update: req.body,
      create: { schoolId, ...req.body },
    });
    res.json(branding);
  } catch (error) { next(error); }
};

module.exports = { getOrgBranding, upsertOrgBranding, getSchoolBranding, upsertSchoolBranding };
