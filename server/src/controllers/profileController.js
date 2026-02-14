const bcrypt = require('bcryptjs');
const prisma = require('../config/database');

/**
 * GET /api/profile
 * Get current user's profile with disciplines, attendance, frequency
 */
const getProfile = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        bio: true,
        beltRank: true,
        schoolId: true,
        createdAt: true,
        school: { select: { id: true, name: true } },
        enrollments: {
          include: { school: { select: { id: true, name: true } } },
          orderBy: { enrolledAt: 'desc' },
        },
      },
    });

    // Get disciplines the user is involved in (via check-ins or taught classes)
    let disciplines = [];
    let attendanceStats = {};

    if (user.role === 'STUDENT') {
      // Get all check-ins with class discipline info
      const checkIns = await prisma.checkIn.findMany({
        where: { studentId: user.id },
        include: {
          session: {
            include: { class: { select: { discipline: true, name: true } } },
          },
        },
        orderBy: { checkedInAt: 'desc' },
      });

      // Compute disciplines and frequency
      const disciplineMap = {};
      const last30Days = new Date();
      last30Days.setDate(last30Days.getDate() - 30);
      let last30Count = 0;

      for (const ci of checkIns) {
        const disc = ci.session.class.discipline;
        if (!disciplineMap[disc]) {
          disciplineMap[disc] = { discipline: disc, totalClasses: 0, lastAttended: null };
        }
        disciplineMap[disc].totalClasses++;
        if (!disciplineMap[disc].lastAttended) {
          disciplineMap[disc].lastAttended = ci.checkedInAt;
        }
        if (ci.checkedInAt >= last30Days) last30Count++;
      }

      disciplines = Object.values(disciplineMap);
      attendanceStats = {
        totalCheckIns: checkIns.length,
        last30Days: last30Count,
        weeklyAvg: checkIns.length > 0
          ? Math.round((last30Count / 4.3) * 10) / 10
          : 0,
      };
    } else if (user.role === 'INSTRUCTOR') {
      // Get classes taught
      const classes = await prisma.class.findMany({
        where: { instructorId: user.id, isActive: true },
        select: { discipline: true, name: true, _count: { select: { sessions: true } } },
      });
      disciplines = classes.map((c) => ({
        discipline: c.discipline,
        className: c.name,
        sessionCount: c._count.sessions,
      }));
    }

    res.json({
      ...user,
      disciplines,
      attendanceStats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/profile
 * Update current user's profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, phone, bio, beltRank, currentPassword, newPassword } = req.body;

    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone;
    if (bio !== undefined) updateData.bio = bio;
    if (beltRank !== undefined) updateData.beltRank = beltRank;

    // Password change
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to set a new password' });
      }
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
      updateData.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        phone: true, role: true, bio: true, beltRank: true,
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/profile/:userId
 * View another user's public profile (staff only)
 */
const getUserProfile = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        bio: true,
        beltRank: true,
        createdAt: true,
        enrollments: {
          where: { status: 'ACTIVE' },
          include: { school: { select: { id: true, name: true } } },
        },
        _count: { select: { checkIns: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get attendance summary
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    const recentCheckIns = await prisma.checkIn.count({
      where: {
        studentId: user.id,
        checkedInAt: { gte: last30Days },
      },
    });

    res.json({
      ...user,
      recentCheckIns,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getProfile, updateProfile, getUserProfile };
