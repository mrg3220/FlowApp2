const prisma = require('../config/database');

// ─── Certificate Templates ──────────────────────────────

const getTemplates = async (req, res, next) => {
  try {
    const where = req.params.schoolId ? { schoolId: req.params.schoolId } : {};
    const templates = await prisma.certificateTemplate.findMany({
      where,
      include: { _count: { select: { certificates: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(templates);
  } catch (error) { next(error); }
};

const createTemplate = async (req, res, next) => {
  try {
    const template = await prisma.certificateTemplate.create({ data: req.body });
    res.status(201).json(template);
  } catch (error) { next(error); }
};

const updateTemplate = async (req, res, next) => {
  try {
    const template = await prisma.certificateTemplate.update({ where: { id: req.params.id }, data: req.body });
    res.json(template);
  } catch (error) { next(error); }
};

const deleteTemplate = async (req, res, next) => {
  try {
    await prisma.certificateTemplate.delete({ where: { id: req.params.id } });
    res.json({ message: 'Template deleted' });
  } catch (error) { next(error); }
};

// ─── Certificates ────────────────────────────────────────

const getCertificates = async (req, res, next) => {
  try {
    const { promotionId, studentName } = req.query;
    const where = {};
    if (promotionId) where.promotionId = promotionId;
    if (studentName) where.studentName = { contains: studentName, mode: 'insensitive' };

    const certs = await prisma.certificate.findMany({
      where,
      include: { template: { select: { name: true } } },
      orderBy: { awardedDate: 'desc' },
    });
    res.json(certs);
  } catch (error) { next(error); }
};

const generateCertificate = async (req, res, next) => {
  try {
    const { templateId, promotionId } = req.body;

    // Get promotion data
    const promotion = await prisma.promotion.findUnique({
      where: { id: promotionId },
      include: {
        enrollment: {
          include: {
            student: { select: { firstName: true, lastName: true } },
            program: { select: { name: true } },
            school: { select: { name: true } },
          },
        },
        toBelt: { select: { name: true } },
      },
    });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });

    const cert = await prisma.certificate.create({
      data: {
        templateId,
        promotionId,
        studentName: `${promotion.enrollment.student.firstName} ${promotion.enrollment.student.lastName}`,
        beltName: promotion.toBelt.name,
        programName: promotion.enrollment.program.name,
        schoolName: promotion.enrollment.school.name,
        awardedDate: promotion.promotedAt,
      },
      include: { template: { select: { name: true, layoutJson: true } } },
    });

    res.status(201).json(cert);
  } catch (error) { next(error); }
};

module.exports = { getTemplates, createTemplate, updateTemplate, deleteTemplate, getCertificates, generateCertificate };
