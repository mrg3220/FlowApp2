const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/database');

/**
 * POST /api/sessions
 * Create a class session (manually or auto-generated)
 */
const createSession = async (req, res, next) => {
  try {
    const { classId, scheduleId, sessionDate, startTime, endTime } = req.body;

    const cls = await prisma.class.findUnique({ where: { id: classId } });
    if (!cls) {
      return res.status(404).json({ error: 'Class not found' });
    }

    const qrCode = `FLOW-${uuidv4().slice(0, 8).toUpperCase()}`;

    const session = await prisma.classSession.create({
      data: {
        classId,
        scheduleId: scheduleId || null,
        sessionDate: new Date(sessionDate),
        startTime,
        endTime,
        qrCode,
      },
      include: {
        class: { select: { id: true, name: true, discipline: true, capacity: true } },
        _count: { select: { checkIns: true } },
      },
    });

    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/sessions
 * List sessions, optionally filtered by classId, date range, status
 */
const getSessions = async (req, res, next) => {
  try {
    const { classId, status, from, to } = req.query;

    const where = {};
    if (classId) where.classId = classId;
    if (status) where.status = status;
    if (from || to) {
      where.sessionDate = {};
      if (from) where.sessionDate.gte = new Date(from);
      if (to) where.sessionDate.lte = new Date(to);
    }

    const sessions = await prisma.classSession.findMany({
      where,
      include: {
        class: {
          select: { id: true, name: true, discipline: true, capacity: true, school: { select: { id: true, name: true } }, instructor: { select: { id: true, firstName: true, lastName: true } } },
        },
        _count: { select: { checkIns: true } },
      },
      orderBy: [{ sessionDate: 'desc' }, { startTime: 'desc' }],
    });

    res.json(sessions);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/sessions/:id
 * Get single session with attendance list
 */
const getSessionById = async (req, res, next) => {
  try {
    const session = await prisma.classSession.findUnique({
      where: { id: req.params.id },
      include: {
        class: {
          select: { id: true, name: true, discipline: true, capacity: true, skillLevel: true },
        },
        checkIns: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
          orderBy: { checkedInAt: 'asc' },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      ...session,
      attendeeCount: session.checkIns.length,
      spotsRemaining: session.class.capacity - session.checkIns.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/sessions/:id/status
 * Update session status (SCHEDULED -> IN_PROGRESS -> COMPLETED or CANCELLED)
 */
const updateSessionStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const session = await prisma.classSession.update({
      where: { id: req.params.id },
      data: { status },
    });

    res.json(session);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/sessions/:id/qr
 * Get the QR code value for a session
 */
const getSessionQr = async (req, res, next) => {
  try {
    const session = await prisma.classSession.findUnique({
      where: { id: req.params.id },
      select: { id: true, qrCode: true, class: { select: { name: true } }, sessionDate: true, startTime: true },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Return QR data — the frontend will generate the QR image
    res.json({
      sessionId: session.id,
      qrCode: session.qrCode,
      className: session.class.name,
      sessionDate: session.sessionDate,
      startTime: session.startTime,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createSession, getSessions, getSessionById, updateSessionStatus, getSessionQr };
