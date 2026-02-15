const prisma = require('../config/database');

// ─── Public Events (no auth required) ────────────────────

const getPublicEvents = async (req, res, next) => {
  try {
    const { eventType, schoolId } = req.query;
    const where = { isPublic: true, startDate: { gte: new Date() } };
    if (eventType) where.eventType = eventType;
    if (schoolId) where.schoolId = schoolId;

    const events = await prisma.event.findMany({
      where,
      select: {
        id: true, name: true, description: true, eventType: true, scope: true,
        startDate: true, endDate: true, ticketPrice: true, maxCapacity: true,
        registrationDeadline: true, imageUrl: true,
        school: { select: { name: true, city: true, state: true } },
        venue: { select: { name: true, city: true, state: true, capacity: true } },
        _count: { select: { tickets: true, registrations: true } },
      },
      orderBy: { startDate: 'asc' },
    });
    res.json(events);
  } catch (error) { next(error); }
};

const getPublicEvent = async (req, res, next) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, name: true, description: true, eventType: true, scope: true,
        startDate: true, endDate: true, ticketPrice: true, maxCapacity: true,
        registrationDeadline: true, imageUrl: true, isPublic: true,
        school: { select: { name: true, city: true, state: true } },
        venue: { select: { name: true, address: true, city: true, state: true, capacity: true } },
        _count: { select: { tickets: true } },
      },
    });
    if (!event || !event.isPublic) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (error) { next(error); }
};

// ─── Public Guest Ticket Purchase ────────────────────────

/**
 * Purchase tickets as an unauthenticated guest.
 * Input validation: requires eventId, guestName, guestEmail.
 * Quantity is bounded to prevent abuse (max 10 per transaction).
 */
const purchaseGuestTicket = async (req, res, next) => {
  try {
    const { eventId, guestName, guestEmail, guestPhone, quantity } = req.body;

    // Input validation — these fields come from unauthenticated users
    if (!eventId || !guestName || !guestEmail) {
      return res.status(400).json({ error: 'eventId, guestName, and guestEmail are required' });
    }
    // Basic email format check (defence in depth)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    // Bound quantity to prevent abuse (max 10 per transaction)
    const qty = Math.min(Math.max(parseInt(quantity, 10) || 1, 1), 10);

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event || !event.isPublic) return res.status(404).json({ error: 'Event not found' });

    if (event.maxCapacity) {
      const sold = await prisma.eventTicket.aggregate({
        where: { eventId, status: { in: ['RESERVED', 'PAID', 'CHECKED_IN'] } },
        _sum: { quantity: true },
      });
      if ((sold._sum.quantity || 0) + qty > event.maxCapacity) {
        return res.status(400).json({ error: 'Not enough seats available' });
      }
    }

    const unitPrice = event.ticketPrice || 0;
    const ticket = await prisma.eventTicket.create({
      data: {
        eventId,
        guestName, guestEmail, guestPhone,
        quantity: qty,
        unitPrice,
        totalPrice: unitPrice * qty,
        status: unitPrice === 0 ? 'PAID' : 'RESERVED',
        purchasedAt: unitPrice === 0 ? new Date() : null,
      },
    });
    res.status(201).json(ticket);
  } catch (error) { next(error); }
};

// ─── Public Shop ─────────────────────────────────────────

const getPublicProducts = async (req, res, next) => {
  try {
    const { category, schoolId } = req.query;
    const where = { isActive: true };

    if (schoolId) {
      // Show school products + org-wide products
      where.OR = [{ schoolId }, { isOrgWide: true }];
    } else {
      // Show only org-wide
      where.isOrgWide = true;
    }

    if (category) where.category = category;

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true, name: true, description: true, price: true, imageUrl: true,
        category: true, isOrgWide: true,
        school: { select: { name: true } },
        inventory: { select: { size: true, color: true, quantity: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(products);
  } catch (error) { next(error); }
};

/**
 * Create a guest order for the public shop.
 * Input validation: requires guestName, guestEmail, and at least one item.
 * Item quantities are bounded to prevent abuse.
 */
const createGuestOrder = async (req, res, next) => {
  try {
    const { guestName, guestEmail, guestPhone, items, schoolId } = req.body;

    if (!guestName || !guestEmail) return res.status(400).json({ error: 'Guest name and email are required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (!items?.length) return res.status(400).json({ error: 'No items provided' });
    if (items.length > 50) return res.status(400).json({ error: 'Too many items in a single order' });

    let subtotal = 0;
    const orderItems = [];
    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product || !product.isActive) return res.status(400).json({ error: `Product not found or inactive` });
      subtotal += product.price * item.quantity;
      orderItems.push({
        productId: item.productId, quantity: item.quantity,
        unitPrice: product.price, size: item.size, color: item.color,
      });
    }

    const count = await prisma.order.count();
    const orderNumber = `PUB-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const order = await prisma.order.create({
      data: {
        orderNumber,
        schoolId: schoolId || null,
        guestName, guestEmail, guestPhone,
        subtotal,
        taxAmount: 0,
        totalAmount: subtotal,
        items: { create: orderItems },
      },
      include: { items: { include: { product: { select: { name: true } } } } },
    });
    res.status(201).json(order);
  } catch (error) { next(error); }
};

// ─── Public Schools List ─────────────────────────────────

const getPublicSchools = async (req, res, next) => {
  try {
    const schools = await prisma.school.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, city: true, state: true, phone: true,
        branding: { select: { logoUrl: true, bannerUrl: true, description: true, welcomeMessage: true, primaryColor: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(schools);
  } catch (error) { next(error); }
};

module.exports = {
  getPublicEvents, getPublicEvent, purchaseGuestTicket,
  getPublicProducts, createGuestOrder, getPublicSchools,
};
