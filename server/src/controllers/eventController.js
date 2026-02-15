const prisma = require('../config/database');

// ─── Events CRUD ─────────────────────────────────────────

const getEvents = async (req, res, next) => {
  try {
    const { schoolId, scope, eventType, isPublic, upcoming } = req.query;
    const where = {};
    if (schoolId) where.schoolId = schoolId;
    if (scope) where.scope = scope;
    if (eventType) where.eventType = eventType;
    if (isPublic !== undefined) where.isPublic = isPublic === 'true';
    if (upcoming === 'true') where.startDate = { gte: new Date() };

    const events = await prisma.event.findMany({
      where,
      include: {
        school: { select: { id: true, name: true } },
        venue: { select: { id: true, name: true, city: true, state: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { tickets: true, registrations: true, tournamentEntries: true } },
      },
      orderBy: { startDate: 'asc' },
    });
    res.json(events);
  } catch (error) { next(error); }
};

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
    res.json(event);
  } catch (error) { next(error); }
};

const createEvent = async (req, res, next) => {
  try {
    const data = { ...req.body, createdById: req.user.id };
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
    if (data.registrationDeadline) data.registrationDeadline = new Date(data.registrationDeadline);
    if (data.ticketPrice) data.ticketPrice = parseFloat(data.ticketPrice);
    if (data.maxCapacity) data.maxCapacity = parseInt(data.maxCapacity);

    const event = await prisma.event.create({
      data,
      include: {
        school: { select: { name: true } },
        venue: { select: { name: true } },
      },
    });
    res.status(201).json(event);
  } catch (error) { next(error); }
};

const updateEvent = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
    if (data.registrationDeadline) data.registrationDeadline = new Date(data.registrationDeadline);
    if (data.ticketPrice !== undefined) data.ticketPrice = parseFloat(data.ticketPrice);
    if (data.maxCapacity !== undefined) data.maxCapacity = parseInt(data.maxCapacity);

    const event = await prisma.event.update({ where: { id: req.params.id }, data });
    res.json(event);
  } catch (error) { next(error); }
};

const deleteEvent = async (req, res, next) => {
  try {
    await prisma.event.delete({ where: { id: req.params.id } });
    res.json({ message: 'Event deleted' });
  } catch (error) { next(error); }
};

// ─── Tickets ─────────────────────────────────────────────

const purchaseTicket = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { quantity, guestName, guestEmail, guestPhone } = req.body;
    const qty = quantity || 1;

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Check capacity
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

const updateTicketStatus = async (req, res, next) => {
  try {
    const ticket = await prisma.eventTicket.update({
      where: { id: req.params.ticketId },
      data: {
        status: req.body.status,
        ...(req.body.status === 'PAID' && { purchasedAt: new Date() }),
        ...(req.body.status === 'CHECKED_IN' && { checkedInAt: new Date() }),
      },
    });
    res.json(ticket);
  } catch (error) { next(error); }
};

// ─── Registrations ───────────────────────────────────────

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

const cancelRegistration = async (req, res, next) => {
  try {
    await prisma.eventRegistration.delete({ where: { id: req.params.regId } });
    res.json({ message: 'Registration cancelled' });
  } catch (error) { next(error); }
};

// ─── Tournament Entries ──────────────────────────────────

const addTournamentEntry = async (req, res, next) => {
  try {
    const entry = await prisma.tournamentEntry.create({
      data: { eventId: req.params.eventId, ...req.body },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    res.status(201).json(entry);
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'Already entered in this tournament' });
    next(error);
  }
};

const updateTournamentEntry = async (req, res, next) => {
  try {
    const entry = await prisma.tournamentEntry.update({
      where: { id: req.params.entryId },
      data: req.body,
    });
    res.json(entry);
  } catch (error) { next(error); }
};

const deleteTournamentEntry = async (req, res, next) => {
  try {
    await prisma.tournamentEntry.delete({ where: { id: req.params.entryId } });
    res.json({ message: 'Entry removed' });
  } catch (error) { next(error); }
};

// ─── Student medal stats ─────────────────────────────────

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
