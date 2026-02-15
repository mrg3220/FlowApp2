const prisma = require('../config/database');

const getContent = async (req, res, next) => {
  try {
    const { schoolId, programId, beltId, category, contentType, search } = req.query;
    const where = {};
    if (schoolId) where.schoolId = schoolId;
    if (programId) where.programId = programId;
    if (beltId) where.beltId = beltId;
    if (category) where.category = category;
    if (contentType) where.contentType = contentType;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (req.user.role === 'STUDENT') where.isPublic = true;

    const content = await prisma.virtualContent.findMany({
      where,
      include: {
        school: { select: { name: true } },
        program: { select: { name: true } },
        belt: { select: { name: true, color: true } },
        _count: { select: { views: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    res.json(content);
  } catch (error) { next(error); }
};

const getContentItem = async (req, res, next) => {
  try {
    const item = await prisma.virtualContent.findUnique({
      where: { id: req.params.id },
      include: {
        program: { select: { name: true } },
        belt: { select: { name: true, color: true } },
        _count: { select: { views: true } },
      },
    });
    if (!item) return res.status(404).json({ error: 'Content not found' });
    res.json(item);
  } catch (error) { next(error); }
};

const createContent = async (req, res, next) => {
  try {
    const content = await prisma.virtualContent.create({ data: req.body });
    res.status(201).json(content);
  } catch (error) { next(error); }
};

const updateContent = async (req, res, next) => {
  try {
    const content = await prisma.virtualContent.update({ where: { id: req.params.id }, data: req.body });
    res.json(content);
  } catch (error) { next(error); }
};

const deleteContent = async (req, res, next) => {
  try {
    await prisma.virtualContent.delete({ where: { id: req.params.id } });
    res.json({ message: 'Content deleted' });
  } catch (error) { next(error); }
};

// ─── Views / Progress Tracking ───────────────────────────

const recordView = async (req, res, next) => {
  try {
    const { watchedSeconds, completed } = req.body;
    const existing = await prisma.videoView.findFirst({
      where: { contentId: req.params.id, userId: req.user.id },
      orderBy: { viewedAt: 'desc' },
    });

    if (existing && !existing.completed) {
      const updated = await prisma.videoView.update({
        where: { id: existing.id },
        data: { watchedSeconds, completed: completed || false },
      });
      return res.json(updated);
    }

    const view = await prisma.videoView.create({
      data: { contentId: req.params.id, userId: req.user.id, watchedSeconds: watchedSeconds || 0, completed: completed || false },
    });
    res.status(201).json(view);
  } catch (error) { next(error); }
};

const getMyViews = async (req, res, next) => {
  try {
    const views = await prisma.videoView.findMany({
      where: { userId: req.user.id },
      include: { content: { select: { title: true, duration: true, contentType: true } } },
      orderBy: { viewedAt: 'desc' },
    });
    res.json(views);
  } catch (error) { next(error); }
};

const getContentStats = async (req, res, next) => {
  try {
    const { id } = req.params;
    const views = await prisma.videoView.aggregate({
      where: { contentId: id },
      _count: true,
    });
    const completed = await prisma.videoView.count({ where: { contentId: id, completed: true } });
    const avgWatch = await prisma.videoView.aggregate({
      where: { contentId: id },
      _avg: { watchedSeconds: true },
    });
    res.json({ totalViews: views._count, completedViews: completed, avgWatchSeconds: Math.round(avgWatch._avg.watchedSeconds || 0) });
  } catch (error) { next(error); }
};

module.exports = { getContent, getContentItem, createContent, updateContent, deleteContent, recordView, getMyViews, getContentStats };
