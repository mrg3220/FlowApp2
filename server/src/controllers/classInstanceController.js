/**
 * Class Controller
 * 
 * Manages "Classes" (individual class meetings/sessions).
 * Previously known as "Sessions" - renamed for clarity.
 * A class is a specific meeting on a date/time.
 */

const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/database');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

const VALID_CLASS_STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

/**
 * POST /api/classes
 * Create a class meeting (manually or auto-generated)
 */
const createClass = async (req, res, next) => {
  try {
    const { programOfferingId, scheduleId, classDate, startTime, endTime } = req.body;

    // Support both old field name (classId) and new (programOfferingId)
    const offeringId = programOfferingId || req.body.classId;

    const offering = await prisma.class.findUnique({ where: { id: offeringId } });
    if (!offering) {
      return res.status(404).json({ error: 'Program offering not found' });
    }

    const qrCode = `FLOW-${uuidv4().slice(0, 8).toUpperCase()}`;

    // Support both old field name (sessionDate) and new (classDate)
    const dateValue = classDate || req.body.sessionDate;

    const newClass = await prisma.classSession.create({
      data: {
        classId: offeringId,
        scheduleId: scheduleId || null,
        sessionDate: new Date(dateValue),
        startTime,
        endTime,
        qrCode,
      },
      include: {
        class: { 
          select: { 
            id: true, 
            name: true, 
            capacity: true,
            program: { select: { id: true, name: true } },
          } 
        },
        _count: { select: { checkIns: true } },
      },
    });

    res.status(201).json(newClass);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/classes
 * List class meetings, optionally filtered by programOfferingId, date range, status
 */
const getClasses = async (req, res, next) => {
  try {
    // Support both old field name (classId) and new (programOfferingId)
    const programOfferingId = req.query.programOfferingId || req.query.classId;
    const { status, from, to } = req.query;
    const { skip, take, page, limit } = parsePagination(req.query);

    const where = {};
    if (programOfferingId) where.classId = programOfferingId;
    if (status) where.status = status;
    if (from || to) {
      where.sessionDate = {};
      if (from) where.sessionDate.gte = new Date(from);
      if (to) where.sessionDate.lte = new Date(to);
    }

    const [classes, total] = await Promise.all([
      prisma.classSession.findMany({
        where,
        include: {
          class: {
            select: { 
              id: true, 
              name: true, 
              capacity: true, 
              program: { select: { id: true, name: true } },
              school: { select: { id: true, name: true } }, 
              instructor: { select: { id: true, firstName: true, lastName: true } } 
            },
          },
          _count: { select: { checkIns: true } },
        },
        orderBy: [{ sessionDate: 'desc' }, { startTime: 'desc' }],
        skip,
        take,
      }),
      prisma.classSession.count({ where }),
    ]);

    res.json(paginatedResponse(classes, total, page, limit));
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/classes/:id
 * Get single class with attendance list
 */
const getClassById = async (req, res, next) => {
  try {
    const cls = await prisma.classSession.findUnique({
      where: { id: req.params.id },
      include: {
        class: {
          select: { 
            id: true, 
            name: true, 
            capacity: true, 
            skillLevel: true,
            program: { 
              select: { 
                id: true, 
                name: true,
                curriculumItems: true,
              } 
            },
          },
        },
        checkIns: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
          orderBy: { checkedInAt: 'asc' },
        },
      },
    });

    if (!cls) {
      return res.status(404).json({ error: 'Class not found' });
    }

    res.json({
      ...cls,
      attendeeCount: cls.checkIns.length,
      spotsRemaining: cls.class.capacity - cls.checkIns.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/classes/:id/status
 * Update class status (SCHEDULED -> IN_PROGRESS -> COMPLETED or CANCELLED)
 */
const updateClassStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    // Validate status against whitelist
    if (!VALID_CLASS_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_CLASS_STATUSES.join(', ')}` });
    }

    const cls = await prisma.classSession.update({
      where: { id: req.params.id },
      data: { status },
    });

    res.json(cls);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/classes/:id/qr
 * Get the QR code value for a class
 */
const getClassQr = async (req, res, next) => {
  try {
    const cls = await prisma.classSession.findUnique({
      where: { id: req.params.id },
      select: { 
        id: true, 
        qrCode: true, 
        class: { select: { name: true } }, 
        sessionDate: true, 
        startTime: true 
      },
    });

    if (!cls) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Return QR data — the frontend will generate the QR image
    res.json({
      classId: cls.id,
      qrCode: cls.qrCode,
      programName: cls.class.name,
      classDate: cls.sessionDate,
      startTime: cls.startTime,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createClass, getClasses, getClassById, updateClassStatus, getClassQr };
