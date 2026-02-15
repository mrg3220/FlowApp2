const prisma = require('../config/database');

const getVenues = async (req, res, next) => {
  try {
    const { schoolId } = req.query;
    const where = {};
    if (schoolId) where.schoolId = schoolId;

    const venues = await prisma.venue.findMany({
      where,
      include: {
        school: { select: { id: true, name: true } },
        _count: { select: { events: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(venues);
  } catch (error) { next(error); }
};

const getVenue = async (req, res, next) => {
  try {
    const venue = await prisma.venue.findUnique({
      where: { id: req.params.id },
      include: {
        school: { select: { name: true } },
        events: { orderBy: { startDate: 'desc' }, take: 10, select: { id: true, name: true, startDate: true, eventType: true } },
      },
    });
    if (!venue) return res.status(404).json({ error: 'Venue not found' });
    res.json(venue);
  } catch (error) { next(error); }
};

const createVenue = async (req, res, next) => {
  try {
    const venue = await prisma.venue.create({ data: req.body });
    res.status(201).json(venue);
  } catch (error) { next(error); }
};

const updateVenue = async (req, res, next) => {
  try {
    const venue = await prisma.venue.update({ where: { id: req.params.id }, data: req.body });
    res.json(venue);
  } catch (error) { next(error); }
};

const deleteVenue = async (req, res, next) => {
  try {
    await prisma.venue.delete({ where: { id: req.params.id } });
    res.json({ message: 'Venue deleted' });
  } catch (error) { next(error); }
};

module.exports = { getVenues, getVenue, createVenue, updateVenue, deleteVenue };
