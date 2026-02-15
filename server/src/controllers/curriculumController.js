const prisma = require('../config/database');

const getCurriculum = async (req, res, next) => {
  try {
    const { schoolId, programId, beltId, category, search } = req.query;
    const where = {};
    if (schoolId) where.schoolId = schoolId;
    if (programId) where.programId = programId;
    if (beltId) where.beltId = beltId;
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    // Students only see public items
    if (req.user.role === 'STUDENT') where.isPublic = true;

    const items = await prisma.curriculumItem.findMany({
      where,
      include: {
        program: { select: { name: true } },
        belt: { select: { name: true, color: true } },
        school: { select: { name: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    });
    res.json(items);
  } catch (error) { next(error); }
};

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
    res.json(item);
  } catch (error) { next(error); }
};

const createCurriculumItem = async (req, res, next) => {
  try {
    const item = await prisma.curriculumItem.create({ data: req.body });
    res.status(201).json(item);
  } catch (error) { next(error); }
};

const updateCurriculumItem = async (req, res, next) => {
  try {
    const item = await prisma.curriculumItem.update({ where: { id: req.params.id }, data: req.body });
    res.json(item);
  } catch (error) { next(error); }
};

const deleteCurriculumItem = async (req, res, next) => {
  try {
    await prisma.curriculumItem.delete({ where: { id: req.params.id } });
    res.json({ message: 'Curriculum item deleted' });
  } catch (error) { next(error); }
};

const getCategories = async (req, res, next) => {
  try {
    const items = await prisma.curriculumItem.findMany({ select: { category: true }, distinct: ['category'], where: { category: { not: null } } });
    res.json(items.map((i) => i.category));
  } catch (error) { next(error); }
};

module.exports = { getCurriculum, getCurriculumItem, createCurriculumItem, updateCurriculumItem, deleteCurriculumItem, getCategories };
