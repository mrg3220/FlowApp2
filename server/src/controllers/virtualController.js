/**
 * ──────────────────────────────────────────────────────────
 * Virtual Content Controller
 * ──────────────────────────────────────────────────────────
 * Manages the virtual training library (videos, documents, links).
 * Includes view tracking and content statistics.
 *
 * Security:
 *   - Explicit field whitelisting (no mass assignment)
 *   - School scoping on all operations
 *   - Students limited to public content
 *   - Paginated list (max 200 per page)
 * ──────────────────────────────────────────────────────────
 */
const prisma = require('../config/database');
const { isSuperRole } = require('../utils/authorization');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

/** @route GET /api/virtual — Paginated content list */
const getContent = async (req, res, next) => {
  try {
    const { schoolId, programId, beltId, category, contentType, search } = req.query;
    const { skip, take, page, limit } = parsePagination(req.query);

    const where = {};
    if (isSuperRole(req.user)) {
      if (schoolId) where.schoolId = schoolId;
    } else {
      where.OR = [{ schoolId: req.user.schoolId }, { schoolId: null }];
    }

    if (programId) where.programId = programId;
    if (beltId) where.beltId = beltId;
    if (category) where.category = category;
    if (contentType) where.contentType = contentType;
    if (search) {
      where.AND = [...(where.AND || []), {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }];
    }
    if (req.user.role === 'STUDENT') where.isPublic = true;

    const [content, total] = await Promise.all([
      prisma.virtualContent.findMany({
        where,
        include: {
          school: { select: { name: true } },
          program: { select: { name: true } },
          belt: { select: { name: true, color: true } },
          _count: { select: { views: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
      prisma.virtualContent.count({ where }),
    ]);

    res.json(paginatedResponse(content, total, page, limit));
  } catch (error) { next(error); }
};

/** @route GET /api/virtual/:id */
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

    // IDOR prevention
    if (!isSuperRole(req.user) && item.schoolId !== null && item.schoolId !== req.user.schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    if (req.user.role === 'STUDENT' && !item.isPublic) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    res.json(item);
  } catch (error) { next(error); }
};

/**
 * Create content. Explicit field whitelist.
 * @route POST /api/virtual
 */
const createContent = async (req, res, next) => {
  try {
    const { schoolId, programId, beltId, title, description, category,
            contentType, url, duration, sortOrder, isPublic } = req.body;

    const effectiveSchoolId = isSuperRole(req.user) ? schoolId : req.user.schoolId;

    const content = await prisma.virtualContent.create({
      data: { schoolId: effectiveSchoolId, programId, beltId, title, description,
              category, contentType, url, duration, sortOrder, isPublic },
    });
    res.status(201).json(content);
  } catch (error) { next(error); }
};

/** @route PUT /api/virtual/:id — Ownership check + field whitelist */
const updateContent = async (req, res, next) => {
  try {
    const existing = await prisma.virtualContent.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Content not found' });
    if (!isSuperRole(req.user) && existing.schoolId !== null && existing.schoolId !== req.user.schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { programId, beltId, title, description, category,
            contentType, url, duration, sortOrder, isPublic } = req.body;

    const content = await prisma.virtualContent.update({
      where: { id: req.params.id },
      data: { programId, beltId, title, description, category, contentType, url, duration, sortOrder, isPublic },
    });
    res.json(content);
  } catch (error) { next(error); }
};

/** @route DELETE /api/virtual/:id */
const deleteContent = async (req, res, next) => {
  try {
    const existing = await prisma.virtualContent.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Content not found' });
    if (!isSuperRole(req.user) && existing.schoolId !== null && existing.schoolId !== req.user.schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    await prisma.virtualContent.delete({ where: { id: req.params.id } });
    res.json({ message: 'Content deleted' });
  } catch (error) { next(error); }
};

// ─── View Tracking ───────────────────────────────────────

/** @route POST /api/virtual/:id/view — Track viewing progress */
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

/** @route GET /api/virtual/my-views — Current user's view history */
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

/** @route GET /api/virtual/:id/stats — View statistics for a content item */
const getContentStats = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [views, completed, avgWatch] = await Promise.all([
      prisma.videoView.aggregate({ where: { contentId: id }, _count: true }),
      prisma.videoView.count({ where: { contentId: id, completed: true } }),
      prisma.videoView.aggregate({ where: { contentId: id }, _avg: { watchedSeconds: true } }),
    ]);
    res.json({
      totalViews: views._count,
      completedViews: completed,
      avgWatchSeconds: Math.round(avgWatch._avg.watchedSeconds || 0),
    });
  } catch (error) { next(error); }
};

module.exports = { getContent, getContentItem, createContent, updateContent, deleteContent, recordView, getMyViews, getContentStats };
