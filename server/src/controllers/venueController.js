/**
 * ──────────────────────────────────────────────────────────
 * Venue Controller
 * ──────────────────────────────────────────────────────────
 * CRUD for event venues. School ownership enforced.
 *
 * Security:
 *   - Explicit field whitelisting (no mass assignment)
 *   - Ownership verified before update/delete
 *   - Paginated list (max 200 per page)
 * ──────────────────────────────────────────────────────────
 */
const prisma = require('../config/database');
const { isSuperRole } = require('../utils/authorization');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

/** @route GET /api/venues — Paginated venue list */
const getVenues = async (req, res, next) => {
  try {
    const { schoolId } = req.query;
    const { skip, take, page, limit } = parsePagination(req.query);

    const where = {};
    if (isSuperRole(req.user)) {
      if (schoolId) where.schoolId = schoolId;
    } else {
      where.schoolId = req.user.schoolId;
    }

    const [venues, total] = await Promise.all([
      prisma.venue.findMany({
        where,
        include: {
          school: { select: { id: true, name: true } },
          _count: { select: { events: true } },
        },
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
      prisma.venue.count({ where }),
    ]);

    res.json(paginatedResponse(venues, total, page, limit));
  } catch (error) { next(error); }
};

/** @route GET /api/venues/:id */
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
    if (!isSuperRole(req.user) && req.user.schoolId !== venue.schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    res.json(venue);
  } catch (error) { next(error); }
};

/**
 * Create venue. Field whitelist prevents mass assignment.
 * @route POST /api/venues
 */
const createVenue = async (req, res, next) => {
  try {
    // Whitelist allowed fields
    const { name, address, city, state, zip, capacity, schoolId, contactInfo, notes } = req.body;

    const effectiveSchoolId = isSuperRole(req.user) ? schoolId : req.user.schoolId;

    const venue = await prisma.venue.create({
      data: { name, address, city, state, zip, capacity, schoolId: effectiveSchoolId, contactInfo, notes },
    });
    res.status(201).json(venue);
  } catch (error) { next(error); }
};

/** @route PUT /api/venues/:id — Ownership check + field whitelist */
const updateVenue = async (req, res, next) => {
  try {
    const existing = await prisma.venue.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Venue not found' });
    if (!isSuperRole(req.user) && req.user.schoolId !== existing.schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { name, address, city, state, zip, capacity, contactInfo, notes } = req.body;
    const venue = await prisma.venue.update({
      where: { id: req.params.id },
      data: { name, address, city, state, zip, capacity, contactInfo, notes },
    });
    res.json(venue);
  } catch (error) { next(error); }
};

/** @route DELETE /api/venues/:id — Ownership verified before deletion */
const deleteVenue = async (req, res, next) => {
  try {
    const existing = await prisma.venue.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Venue not found' });
    if (!isSuperRole(req.user) && req.user.schoolId !== existing.schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    await prisma.venue.delete({ where: { id: req.params.id } });
    res.json({ message: 'Venue deleted' });
  } catch (error) { next(error); }
};

module.exports = { getVenues, getVenue, createVenue, updateVenue, deleteVenue };
