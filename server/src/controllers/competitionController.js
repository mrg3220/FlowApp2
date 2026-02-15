const prisma = require('../config/database');

const getCompetitions = async (req, res, next) => {
  try {
    const { schoolId } = req.query;
    const where = {};
    if (schoolId) where.schoolId = schoolId;

    const competitions = await prisma.competition.findMany({
      where,
      include: {
        school: { select: { name: true } },
        _count: { select: { entries: true } },
      },
      orderBy: { eventDate: 'desc' },
    });
    res.json(competitions);
  } catch (error) { next(error); }
};

const getCompetition = async (req, res, next) => {
  try {
    const comp = await prisma.competition.findUnique({
      where: { id: req.params.id },
      include: {
        entries: {
          include: { student: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: [{ division: 'asc' }, { placement: 'asc' }],
        },
      },
    });
    if (!comp) return res.status(404).json({ error: 'Competition not found' });
    res.json(comp);
  } catch (error) { next(error); }
};

const createCompetition = async (req, res, next) => {
  try {
    const comp = await prisma.competition.create({
      data: { ...req.body, eventDate: new Date(req.body.eventDate) },
    });
    res.status(201).json(comp);
  } catch (error) { next(error); }
};

const updateCompetition = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (data.eventDate) data.eventDate = new Date(data.eventDate);
    const comp = await prisma.competition.update({ where: { id: req.params.id }, data });
    res.json(comp);
  } catch (error) { next(error); }
};

const deleteCompetition = async (req, res, next) => {
  try {
    await prisma.competition.delete({ where: { id: req.params.id } });
    res.json({ message: 'Competition deleted' });
  } catch (error) { next(error); }
};

// ─── Entries ─────────────────────────────────────────────

const addEntry = async (req, res, next) => {
  try {
    const entry = await prisma.competitionEntry.create({
      data: { competitionId: req.params.id, ...req.body },
      include: { student: { select: { firstName: true, lastName: true } } },
    });
    res.status(201).json(entry);
  } catch (error) { next(error); }
};

const updateEntry = async (req, res, next) => {
  try {
    const entry = await prisma.competitionEntry.update({ where: { id: req.params.entryId }, data: req.body });
    res.json(entry);
  } catch (error) { next(error); }
};

const deleteEntry = async (req, res, next) => {
  try {
    await prisma.competitionEntry.delete({ where: { id: req.params.entryId } });
    res.json({ message: 'Entry deleted' });
  } catch (error) { next(error); }
};

// ─── Medal stats per student ─────────────────────────────

const getStudentMedalStats = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const entries = await prisma.competitionEntry.findMany({
      where: { studentId },
      include: { competition: { select: { name: true, eventDate: true } } },
      orderBy: { competition: { eventDate: 'desc' } },
    });

    const medals = { GOLD: 0, SILVER: 0, BRONZE: 0, NONE: 0 };
    entries.forEach((e) => { medals[e.medal] = (medals[e.medal] || 0) + 1; });

    res.json({ entries, medals, totalEvents: entries.length });
  } catch (error) { next(error); }
};

module.exports = { getCompetitions, getCompetition, createCompetition, updateCompetition, deleteCompetition, addEntry, updateEntry, deleteEntry, getStudentMedalStats };
