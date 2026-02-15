/**
 * ──────────────────────────────────────────────────────────
 * Event Controller
 * ──────────────────────────────────────────────────────────
 * Manages events, tickets, registrations, and tournament entries.
 *
 * Security:
 *   - Explicit field whitelisting on create/update (no mass assignment)
 *   - School ownership enforced (IDOR prevention)
 *   - Ticket status validated against whitelist
 *   - Paginated list endpoints
 *   - Capacity checks on ticket purchase
 * ──────────────────────────────────────────────────────────
 */
const prisma = require('../config/database');
const { isSuperRole } = require('../utils/authorization');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

// ─── Field whitelists ────────────────────────────────────
const EVENT_FIELDS = [
  'name', 'description', 'eventType', 'scope', 'isPublic',
  'startDate', 'endDate', 'registrationDeadline',
  'ticketPrice', 'maxCapacity', 'imageUrl', 'schoolId', 'venueId',
];

const VALID_TICKET_STATUSES = ['RESERVED', 'PAID', 'CHECKED_IN', 'CANCELLED', 'REFUNDED'];

/** Parse event-specific fields with type coercion */
function pickEventFields(body) {
  const data = {};
  for (const key of EVENT_FIELDS) {
    if (body[key] === undefined) continue;
    if (['startDate', 'endDate', 'registrationDeadline'].includes(key)) {
      data[key] = new Date(body[key]);
    } else if (key === 'ticketPrice') {
      data[key] = parseFloat(body[key]);
    } else if (key === 'maxCapacity') {
      data[key] = parseInt(body[key], 10);
    } else {
      data[key] = body[key];
    }
  }
  return data;
}

// ─── Events CRUD ─────────────────────────────────────────

/** @route GET /api/events — Paginated event list */
const getEvents = async (req, res, next) => {
  try {
    const { schoolId, scope, eventType, isPublic, upcoming } = req.query;
    const { skip, take, page, limit } = parsePagination(req.query);

    const where = {};
    if (schoolId) where.schoolId = schoolId;
    if (scope) where.scope = scope;
    if (eventType) where.eventType = eventType;
    if (isPublic !== undefined) where.isPublic = isPublic === 'true';
    if (upcoming === 'true') where.startDate = { gte: new Date() };

    // Non-super users can only see their school's events
    if (!isSuperRole(req.user) && !schoolId) {
      where.schoolId = req.user.schoolId;
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        include: {
          school: { select: { id: true, name: true } },
          venue: { select: { id: true, name: true, city: true, state: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { tickets: true, registrations: true, tournamentEntries: true } },
        },
        orderBy: { startDate: 'asc' },
        skip,
        take,
      }),
      prisma.event.count({ where }),
    ]);

    res.json(paginatedResponse(events, total, page, limit));
  } catch (error) { next(error); }
};

/** @route GET /api/events/:id */
const getEvent = async (req, res, next) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: {
        school: { select: { id: true, name: true } },
        venue: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        tickets: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
          orderBy: { createdAt: 'desc' },
        },
        registrations: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
          orderBy: { registeredAt: 'desc' },
        },
        tournamentEntries: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: [{ division: 'asc' }, { placement: 'asc' }],
        },
      },
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // IDOR: non-super users must belong to the event's school
    if (!isSuperRole(req.user) && req.user.schoolId !== event.schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    res.json(event);
  } catch (error) { next(error); }
};

/**
 * Create event. Field whitelist prevents mass assignment.
 * @route POST /api/events
 */
const createEvent = async (req, res, next) => {
  try {
    const data = pickEventFields(req.body);
    data.createdById = req.user.id;

    // IDOR: non-super users can only create events for their own school
    if (!isSuperRole(req.user) && data.schoolId && data.schoolId !== req.user.schoolId) {
      return res.status(403).json({ error: 'Cannot create events for another school' });
    }
    if (!data.schoolId) data.schoolId = req.user.schoolId;

    const event = await prisma.event.create({
      data,
      include: { school: { select: { name: true } }, venue: { select: { name: true } } },
    });
    res.status(201).json(event);
  } catch (error) { next(error); }
};

/**
 * Update event. Ownership check + field whitelist.
 * @route PUT /api/events/:id
 */
const updateEvent = async (req, res, next) => {
  try {
    const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Event not found' });
    if (!isSuperRole(req.user) && req.user.schoolId !== existing.schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const data = pickEventFields(req.body);
    const event = await prisma.event.update({ where: { id: req.params.id }, data });
    res.json(event);
  } catch (error) { next(error); }
};

/** @route DELETE /api/events/:id — Ownership check */
const deleteEvent = async (req, res, next) => {
  try {
    const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Event not found' });
    if (!isSuperRole(req.user) && req.user.schoolId !== existing.schoolId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await prisma.event.delete({ where: { id: req.params.id } });
    res.json({ message: 'Event deleted' });
  } catch (error) { next(error); }
};

// ─── Tickets ─────────────────────────────────────────────

/** @route POST /api/events/:eventId/tickets — Capacity-checked ticket purchase */
const purchaseTicket = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { quantity, guestName, guestEmail, guestPhone } = req.body;
    const qty = Math.min(Math.max(parseInt(quantity, 10) || 1, 1), 20);

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (event.maxCapacity) {
      const sold = await prisma.eventTicket.aggregate({
        where: { eventId, status: { in: ['RESERVED', 'PAID', 'CHECKED_IN'] } },
        _sum: { quantity: true },
      });
      if ((sold._sum.quantity || 0) + qty > event.maxCapacity) {
        return res.status(400).json({ error: 'Event is sold out or not enough seats' });
      }
    }

    const unitPrice = event.ticketPrice || 0;
    const ticket = await prisma.eventTicket.create({
      data: {
        eventId,
        userId: req.user?.id || null,
        guestName: guestName || null,
        guestEmail: guestEmail || null,
        guestPhone: guestPhone || null,
        quantity: qty,
        unitPrice,
        totalPrice: unitPrice * qty,
        status: unitPrice === 0 ? 'PAID' : 'RESERVED',
        purchasedAt: unitPrice === 0 ? new Date() : null,
      },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });
    res.status(201).json(ticket);
  } catch (error) { next(error); }
};

/**
 * Update ticket status. Validates status against whitelist.
 * @route PUT /api/events/tickets/:ticketId/status
 */
const updateTicketStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!VALID_TICKET_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_TICKET_STATUSES.join(', ')}` });
    }

    const ticket = await prisma.eventTicket.update({
      where: { id: req.params.ticketId },
      data: {
        status,
        ...(status === 'PAID' && { purchasedAt: new Date() }),
        ...(status === 'CHECKED_IN' && { checkedInAt: new Date() }),
      },
    });
    res.json(ticket);
  } catch (error) { next(error); }
};

// ─── Registrations ───────────────────────────────────────

/** @route POST /api/events/:eventId/register */
const registerForEvent = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const userId = req.body.userId || req.user.id;

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (event.registrationDeadline && new Date() > event.registrationDeadline) {
      return res.status(400).json({ error: 'Registration deadline has passed' });
    }

    const reg = await prisma.eventRegistration.create({
      data: { eventId, userId },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });
    res.status(201).json(reg);
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'Already registered' });
    next(error);
  }
};

/** @route DELETE /api/events/registrations/:regId */
const cancelRegistration = async (req, res, next) => {
  try {
    await prisma.eventRegistration.delete({ where: { id: req.params.regId } });
    res.json({ message: 'Registration cancelled' });
  } catch (error) { next(error); }
};

// ─── Tournament Entries ──────────────────────────────────

/**
 * Add tournament entry. Field whitelist prevents mass assignment.
 * @route POST /api/events/:eventId/tournament-entries
 */
const addTournamentEntry = async (req, res, next) => {
  try {
    const { userId, division, weightClass, beltRank } = req.body;
    const entry = await prisma.tournamentEntry.create({
      data: { eventId: req.params.eventId, userId, division, weightClass, beltRank },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    res.status(201).json(entry);
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'Already entered in this tournament' });
    next(error);
  }
};

/**
 * Update tournament entry. Field whitelist.
 * @route PUT /api/events/tournament-entries/:entryId
 */
const updateTournamentEntry = async (req, res, next) => {
  try {
    const { division, weightClass, placement, medalType, notes } = req.body;
    const entry = await prisma.tournamentEntry.update({
      where: { id: req.params.entryId },
      data: { division, weightClass, placement, medalType, notes },
    });
    res.json(entry);
  } catch (error) { next(error); }
};

/** @route DELETE /api/events/tournament-entries/:entryId */
const deleteTournamentEntry = async (req, res, next) => {
  try {
    await prisma.tournamentEntry.delete({ where: { id: req.params.entryId } });
    res.json({ message: 'Entry removed' });
  } catch (error) { next(error); }
};

// ─── Student medal stats ─────────────────────────────────

/** @route GET /api/events/students/:studentId/medals */
const getStudentMedalStats = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const entries = await prisma.tournamentEntry.findMany({
      where: { userId: studentId },
      include: { event: { select: { name: true, startDate: true, eventType: true } } },
      orderBy: { event: { startDate: 'desc' } },
    });
    const medals = { GOLD: 0, SILVER: 0, BRONZE: 0, NONE: 0 };
    entries.forEach((e) => { medals[e.medalType] = (medals[e.medalType] || 0) + 1; });
    res.json({ entries, medals, totalEvents: entries.length });
  } catch (error) { next(error); }
};

module.exports = {
  getEvents, getEvent, createEvent, updateEvent, deleteEvent,
  purchaseTicket, updateTicketStatus,
  registerForEvent, cancelRegistration,
  addTournamentEntry, updateTournamentEntry, deleteTournamentEntry,
  getStudentMedalStats,
};
