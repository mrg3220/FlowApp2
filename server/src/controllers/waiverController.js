const prisma = require('../config/database');

// ─── Waiver Templates ────────────────────────────────────

const getTemplates = async (req, res, next) => {
  try {
    const templates = await prisma.waiverTemplate.findMany({
      where: { schoolId: req.params.schoolId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { waivers: true } } },
    });
    res.json(templates);
  } catch (error) { next(error); }
};

const createTemplate = async (req, res, next) => {
  try {
    const template = await prisma.waiverTemplate.create({
      data: { schoolId: req.params.schoolId, ...req.body },
    });
    res.status(201).json(template);
  } catch (error) { next(error); }
};

const updateTemplate = async (req, res, next) => {
  try {
    const template = await prisma.waiverTemplate.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(template);
  } catch (error) { next(error); }
};

// ─── Waivers ─────────────────────────────────────────────

const getWaivers = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const { status, userId } = req.query;
    const where = { schoolId };
    if (status) where.status = status;
    if (userId) where.userId = userId;

    const waivers = await prisma.waiver.findMany({
      where,
      include: {
        template: { select: { title: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(waivers);
  } catch (error) { next(error); }
};

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

const sendWaiver = async (req, res, next) => {
  try {
    const { templateId, schoolId, userId } = req.body;
    const waiver = await prisma.waiver.create({
      data: { templateId, schoolId, userId, status: 'PENDING' },
      include: { template: { select: { title: true } }, user: { select: { firstName: true, lastName: true } } },
    });
    res.status(201).json(waiver);
  } catch (error) { next(error); }
};

const signWaiver = async (req, res, next) => {
  try {
    const waiver = await prisma.waiver.update({
      where: { id: req.params.id },
      data: {
        status: 'SIGNED',
        signedAt: new Date(),
        signatureData: req.body.signatureData,
        ipAddress: req.ip,
      },
    });
    res.json(waiver);
  } catch (error) { next(error); }
};

module.exports = { getTemplates, createTemplate, updateTemplate, getWaivers, getMyWaivers, sendWaiver, signWaiver };
