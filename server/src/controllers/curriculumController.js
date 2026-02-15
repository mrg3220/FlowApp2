/**
 * ──────────────────────────────────────────────────────────
 * Curriculum Controller
 * ──────────────────────────────────────────────────────────
 * CRUD for the technique library / curriculum items.
 *
 * Security:
 *   - Explicit field whitelisting (no mass assignment)
 *   - School scoping: non-super users see own school + global items
 *   - Students restricted to public items only
 *   - Paginated list endpoint (max 200 per page)
 * ──────────────────────────────────────────────────────────
 */
const prisma = require('../config/database');
const { isSuperRole } = require('../utils/authorization');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

/**
 * List curriculum items with filters and pagination.
 * @route GET /api/curriculum
 * @query schoolId, programId, beltId, category, search, page, limit
 */
const getCurriculum = async (req, res, next) => {
  try {
    const { schoolId, programId, beltId, category, search } = req.query;
    const { skip, take, page, limit } = parsePagination(req.query);

    const where = {};

    // School scoping — IDOR prevention
    if (isSuperRole(req.user)) {
      if (schoolId) where.schoolId = schoolId;
    } else {
      if (schoolId && schoolId !== req.user.schoolId) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      where.OR = [{ schoolId: req.user.schoolId }, { schoolId: null }];
    }

    if (programId) where.programId = programId;
    if (beltId) where.beltId = beltId;
    if (category) where.category = category;
    if (search) {
      where.AND = [...(where.AND || []), {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }];
    }

    // Students see public items only
    if (req.user.role === 'STUDENT') where.isPublic = true;

    const [items, total] = await Promise.all([
      prisma.curriculumItem.findMany({
        where,
        include: {
          program: { select: { name: true } },
          belt: { select: { name: true, color: true } },
          school: { select: { name: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
        skip,
        take,
      }),
      prisma.curriculumItem.count({ where }),
    ]);

    res.json(paginatedResponse(items, total, page, limit));
  } catch (error) {
    next(error);
  }
};

/** @route GET /api/curriculum/:id */
const getCurriculumItem = async (req, res, next) => {
  try {
    const item = await prisma.curriculumItem.findUnique({
      where: { id: req.params.id },
      include: {
        program: { select: { name: true } },
        belt: { select: { name: true, color: true } },
      },
    });
    if (!item) return res.status(404).json({ error: 'Item not found' });

    // IDOR: non-super users can access own school + global only
    if (!isSuperRole(req.user) && item.schoolId !== null && item.schoolId !== req.user.schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    if (req.user.role === 'STUDENT' && !item.isPublic) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    res.json(item);
  } catch (error) {
    next(error);
  }
};

/**
 * Create curriculum item. Field whitelist prevents mass assignment.
 * Non-super users are forced to their own schoolId.
 * @route POST /api/curriculum
 */
const createCurriculumItem = async (req, res, next) => {
  try {
    // Whitelist allowed fields
    const { schoolId, programId, beltId, title, description,
            category, videoUrl, imageUrl, sortOrder, isPublic } = req.body;

    // IDOR: non-super users can only create for their school
    const effectiveSchoolId = isSuperRole(req.user) ? schoolId : req.user.schoolId;
    if (!isSuperRole(req.user) && schoolId && schoolId !== req.user.schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const item = await prisma.curriculumItem.create({
      data: {
        schoolId: effectiveSchoolId, programId, beltId, title, description,
        category, videoUrl, imageUrl, sortOrder, isPublic,
      },
    });
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
};

/** @route PUT /api/curriculum/:id — Ownership check + field whitelist */
const updateCurriculumItem = async (req, res, next) => {
  try {
    const existing = await prisma.curriculumItem.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Item not found' });

    if (!isSuperRole(req.user) && existing.schoolId !== null && existing.schoolId !== req.user.schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { programId, beltId, title, description,
            category, videoUrl, imageUrl, sortOrder, isPublic } = req.body;

    const item = await prisma.curriculumItem.update({
      where: { id: req.params.id },
      data: { programId, beltId, title, description, category, videoUrl, imageUrl, sortOrder, isPublic },
    });
    res.json(item);
  } catch (error) {
    next(error);
  }
};

/** @route DELETE /api/curriculum/:id — Ownership verified before deletion */
const deleteCurriculumItem = async (req, res, next) => {
  try {
    const existing = await prisma.curriculumItem.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Item not found' });
    if (!isSuperRole(req.user) && existing.schoolId !== null && existing.schoolId !== req.user.schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    await prisma.curriculumItem.delete({ where: { id: req.params.id } });
    res.json({ message: 'Curriculum item deleted' });
  } catch (error) {
    next(error);
  }
};

/** @route GET /api/curriculum/categories — Distinct category names */
const getCategories = async (req, res, next) => {
  try {
    const where = { category: { not: null } };
    if (!isSuperRole(req.user)) {
      where.OR = [{ schoolId: req.user.schoolId }, { schoolId: null }];
    }
    const items = await prisma.curriculumItem.findMany({
      select: { category: true },
      distinct: ['category'],
      where,
    });
    res.json(items.map((i) => i.category));
  } catch (error) {
    next(error);
  }
};

module.exports = { getCurriculum, getCurriculumItem, createCurriculumItem, updateCurriculumItem, deleteCurriculumItem, getCategories };
