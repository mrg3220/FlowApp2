const prisma = require('../config/database');

// ─── Applications CRUD ───────────────────────────────────

const getApplications = async (req, res, next) => {
  try {
    const { status, targetTitle, userId } = req.query;
    const where = {};
    if (status) where.status = status;
    if (targetTitle) where.targetTitle = targetTitle;
    if (userId) where.userId = userId;

    // Students see only their own; reviewers see all
    if (req.user.role === 'STUDENT') {
      where.userId = req.user.id;
    }

    const apps = await prisma.certificationApplication.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, title: true, beltRank: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(apps);
  } catch (error) { next(error); }
};

const getApplication = async (req, res, next) => {
  try {
    const app = await prisma.certificationApplication.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, title: true, beltRank: true, schoolId: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!app) return res.status(404).json({ error: 'Application not found' });
    if (req.user.role === 'STUDENT' && app.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(app);
  } catch (error) { next(error); }
};

const createApplication = async (req, res, next) => {
  try {
    const { targetTitle, applicationData, feeAmount } = req.body;

    // Fee schedule
    const fees = { LOHAN_CANDIDATE: 250, LOHAN_CERTIFIED: 500, SIFU_ASSOCIATE: 750, SIFU: 1000 };
    const fee = feeAmount || fees[targetTitle] || 0;

    const app = await prisma.certificationApplication.create({
      data: {
        userId: req.user.id,
        targetTitle,
        applicationData: applicationData || {},
        feeAmount: fee,
        status: 'DRAFT',
      },
    });
    res.status(201).json(app);
  } catch (error) { next(error); }
};

const updateApplication = async (req, res, next) => {
  try {
    const existing = await prisma.certificationApplication.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (existing.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (!['DRAFT', 'DENIED'].includes(existing.status)) {
      return res.status(400).json({ error: 'Can only edit draft or denied applications' });
    }

    const app = await prisma.certificationApplication.update({
      where: { id: req.params.id },
      data: { applicationData: req.body.applicationData, targetTitle: req.body.targetTitle },
    });
    res.json(app);
  } catch (error) { next(error); }
};

// ─── Submit ──────────────────────────────────────────────

const submitApplication = async (req, res, next) => {
  try {
    const existing = await prisma.certificationApplication.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (existing.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (!['DRAFT', 'DENIED'].includes(existing.status)) {
      return res.status(400).json({ error: 'Cannot submit this application' });
    }

    const app = await prisma.certificationApplication.update({
      where: { id: req.params.id },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
    });
    res.json(app);
  } catch (error) { next(error); }
};

// ─── Review (SUPER_ADMIN / OWNER) ────────────────────────

const reviewApplication = async (req, res, next) => {
  try {
    const { status, reviewNotes } = req.body; // APPROVED or DENIED
    if (!['APPROVED', 'DENIED', 'UNDER_REVIEW'].includes(status)) {
      return res.status(400).json({ error: 'Invalid review status' });
    }

    const data = {
      status,
      reviewNotes,
      reviewedById: req.user.id,
      reviewedAt: new Date(),
    };

    const app = await prisma.certificationApplication.update({
      where: { id: req.params.id },
      data,
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });

    // On approval, update user title
    if (status === 'APPROVED') {
      await prisma.user.update({
        where: { id: app.userId },
        data: { title: app.targetTitle },
      });
    }

    res.json(app);
  } catch (error) { next(error); }
};

// ─── Withdraw ────────────────────────────────────────────

const withdrawApplication = async (req, res, next) => {
  try {
    const existing = await prisma.certificationApplication.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (existing.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (['APPROVED', 'WITHDRAWN'].includes(existing.status)) {
      return res.status(400).json({ error: 'Cannot withdraw this application' });
    }

    const app = await prisma.certificationApplication.update({
      where: { id: req.params.id },
      data: { status: 'WITHDRAWN' },
    });
    res.json(app);
  } catch (error) { next(error); }
};

// ─── Mark fee paid ───────────────────────────────────────

const markFeePaid = async (req, res, next) => {
  try {
    const app = await prisma.certificationApplication.update({
      where: { id: req.params.id },
      data: { feePaid: true },
    });
    res.json(app);
  } catch (error) { next(error); }
};

module.exports = {
  getApplications, getApplication, createApplication, updateApplication,
  submitApplication, reviewApplication, withdrawApplication, markFeePaid,
};
