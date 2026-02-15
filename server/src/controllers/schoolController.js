const prisma = require('../config/database');

/**
 * POST /api/schools
 * Create a new school (SUPER_ADMIN only)
 */
const createSchool = async (req, res, next) => {
  try {
    const { name, address, city, state, zip, phone, email, ownerId } = req.body;

    // Validate owner exists and has OWNER role
    if (ownerId) {
      const owner = await prisma.user.findUnique({ where: { id: ownerId } });
      if (!owner || owner.role !== 'OWNER') {
        return res.status(400).json({ error: 'Owner must be a user with OWNER role' });
      }
    }

    const school = await prisma.school.create({
      data: {
        name,
        address: address || null,
        city: city || null,
        state: state || null,
        zip: zip || null,
        phone: phone || null,
        email: email || null,
        ownerId: ownerId || req.user.id,
      },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { classes: true, enrollments: true } },
      },
    });

    // Update owner's schoolId if not already set
    if (ownerId) {
      await prisma.user.update({
        where: { id: ownerId },
        data: { schoolId: school.id },
      });
    }

    res.status(201).json(school);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/schools
 * List schools — SUPER_ADMIN sees all, OWNER sees theirs
 */
const getSchools = async (req, res, next) => {
  try {
    const where = { isActive: true };

    // OWNER only sees their own schools
    if (req.user.role === 'OWNER') {
      where.ownerId = req.user.id;
    } else if (req.user.role === 'INSTRUCTOR') {
      // Instructors see the school they're affiliated with
      where.id = req.user.schoolId || 'none';
    }

    const schools = await prisma.school.findMany({
      where,
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { classes: true, enrollments: true, staff: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ data: schools });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/schools/:id
 */
const getSchoolById = async (req, res, next) => {
  try {
    const school = await prisma.school.findUnique({
      where: { id: req.params.id },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        staff: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        classes: {
          where: { isActive: true },
          include: {
            instructor: { select: { id: true, firstName: true, lastName: true } },
            _count: { select: { sessions: true } },
          },
        },
        _count: { select: { enrollments: true } },
      },
    });

    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    // Access check: SUPER_ADMIN can see all, OWNER must own it, INSTRUCTOR must be affiliated
    if (req.user.role === 'OWNER' && school.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user.role === 'INSTRUCTOR' && req.user.schoolId !== school.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(school);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/schools/:id
 */
const updateSchool = async (req, res, next) => {
  try {
    const { name, address, city, state, zip, phone, email, ownerId, isActive } = req.body;

    // OWNER can only update their own school
    if (req.user.role === 'OWNER') {
      const school = await prisma.school.findUnique({ where: { id: req.params.id } });
      if (!school || school.ownerId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const updated = await prisma.school.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(address !== undefined && { address }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(zip !== undefined && { zip }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(ownerId !== undefined && { ownerId }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { classes: true, enrollments: true } },
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/schools/:id (soft-delete)
 */
const deleteSchool = async (req, res, next) => {
  try {
    await prisma.school.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ message: 'School deactivated' });
  } catch (error) {
    next(error);
  }
};

module.exports = { createSchool, getSchools, getSchoolById, updateSchool, deleteSchool };
