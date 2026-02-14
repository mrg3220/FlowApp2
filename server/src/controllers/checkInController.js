const prisma = require('../config/database');

/**
 * POST /api/checkins
 * Check a student into a session
 */
const checkIn = async (req, res, next) => {
  try {
    const { sessionId, studentId, method } = req.body;

    // Validate session exists and is active
    const session = await prisma.classSession.findUnique({
      where: { id: sessionId },
      include: {
        class: { select: { capacity: true } },
        _count: { select: { checkIns: true } },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Cannot check into a cancelled session' });
    }

    if (session.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Session has already ended' });
    }

    // Check capacity
    if (session._count.checkIns >= session.class.capacity) {
      return res.status(400).json({ error: 'Class is at capacity' });
    }

    // Validate student exists
    const student = await prisma.user.findUnique({ where: { id: studentId } });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Determine check-in method and admin reference
    const checkedInBy = method === 'ADMIN' ? req.user.id : null;

    const checkInRecord = await prisma.checkIn.create({
      data: {
        sessionId,
        studentId,
        method: method || 'ADMIN',
        checkedInBy,
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
        session: { select: { id: true, class: { select: { name: true } }, sessionDate: true } },
      },
    });

    res.status(201).json(checkInRecord);
  } catch (error) {
    // Unique constraint violation = already checked in
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Student is already checked into this session' });
    }
    next(error);
  }
};

/**
 * POST /api/checkins/qr
 * Check in via QR code
 */
const checkInByQr = async (req, res, next) => {
  try {
    const { qrCode, studentId } = req.body;

    const session = await prisma.classSession.findUnique({
      where: { qrCode },
      include: {
        class: { select: { capacity: true, name: true } },
        _count: { select: { checkIns: true } },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Invalid QR code' });
    }

    if (session.status === 'CANCELLED' || session.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    if (session._count.checkIns >= session.class.capacity) {
      return res.status(400).json({ error: 'Class is at capacity' });
    }

    const checkInRecord = await prisma.checkIn.create({
      data: {
        sessionId: session.id,
        studentId,
        method: 'QR_CODE',
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.status(201).json({
      ...checkInRecord,
      className: session.class.name,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Already checked in to this session' });
    }
    next(error);
  }
};

/**
 * POST /api/checkins/kiosk
 * Check in via kiosk (student self-service by email)
 */
const checkInByKiosk = async (req, res, next) => {
  try {
    const { sessionId, email } = req.body;

    const student = await prisma.user.findUnique({ where: { email } });
    if (!student) {
      return res.status(404).json({ error: 'No student found with that email' });
    }

    const session = await prisma.classSession.findUnique({
      where: { id: sessionId },
      include: {
        class: { select: { capacity: true, name: true } },
        _count: { select: { checkIns: true } },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status === 'CANCELLED' || session.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    if (session._count.checkIns >= session.class.capacity) {
      return res.status(400).json({ error: 'Class is at capacity' });
    }

    const checkInRecord = await prisma.checkIn.create({
      data: {
        sessionId,
        studentId: student.id,
        method: 'KIOSK',
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.status(201).json({
      ...checkInRecord,
      className: session.class.name,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Already checked in to this session' });
    }
    next(error);
  }
};

/**
 * DELETE /api/checkins/:id
 * Remove a check-in (undo)
 */
const removeCheckIn = async (req, res, next) => {
  try {
    await prisma.checkIn.delete({ where: { id: req.params.id } });
    res.json({ message: 'Check-in removed' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/checkins/attendance/:sessionId
 * Get attendance report for a session
 */
const getAttendance = async (req, res, next) => {
  try {
    const session = await prisma.classSession.findUnique({
      where: { id: req.params.sessionId },
      include: {
        class: { select: { id: true, name: true, discipline: true, capacity: true } },
        checkIns: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true, email: true } },
            admin: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { checkedInAt: 'asc' },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      session: {
        id: session.id,
        date: session.sessionDate,
        startTime: session.startTime,
        endTime: session.endTime,
        status: session.status,
      },
      class: session.class,
      attendance: {
        total: session.checkIns.length,
        capacity: session.class.capacity,
        spotsRemaining: session.class.capacity - session.checkIns.length,
        students: session.checkIns.map((ci) => ({
          checkInId: ci.id,
          student: ci.student,
          method: ci.method,
          checkedInAt: ci.checkedInAt,
          checkedInBy: ci.admin || null,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { checkIn, checkInByQr, checkInByKiosk, removeCheckIn, getAttendance };
