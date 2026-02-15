/**
 * ──────────────────────────────────────────────────────────
 * IT Admin Controller
 * ──────────────────────────────────────────────────────────
 * Endpoints for IT admins (SUPER_ADMIN + IT_ADMIN):
 *   - User management (list, update role, disable/enable, reset password)
 *   - Audit log viewing
 *   - System settings management
 *
 * All write operations are audit-logged automatically.
 * ──────────────────────────────────────────────────────────
 */

const prisma = require('../config/database');
const bcrypt = require('bcryptjs');

// ─── Helpers ─────────────────────────────────────────────

async function writeAudit(performerId, action, targetType, targetId, details, req) {
  await prisma.auditLog.create({
    data: {
      performerId,
      action,
      targetType,
      targetId,
      details,
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent']?.substring(0, 512),
    },
  });
}

// ─── User Management ─────────────────────────────────────

/**
 * GET /api/admin/users
 * List all users with search, filter, pagination.
 * Query: ?search=&role=&isActive=&page=1&limit=25
 */
const listUsers = async (req, res, next) => {
  try {
    const { search, role, isActive, page = 1, limit = 25 } = req.query;
    const take = Math.min(parseInt(limit, 10) || 25, 100);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

    const where = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, email: true, firstName: true, lastName: true,
          phone: true, role: true, title: true, schoolId: true,
          isActive: true, disabledAt: true, disabledBy: true,
          createdAt: true, updatedAt: true,
          school: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, total, page: parseInt(page, 10) || 1, limit: take });
  } catch (err) { next(err); }
};

/**
 * GET /api/admin/users/:id
 * Get single user detail.
 */
const getUser = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        phone: true, role: true, title: true, bio: true, beltRank: true,
        schoolId: true, isActive: true, disabledAt: true, disabledBy: true,
        dateOfBirth: true, createdAt: true, updatedAt: true,
        school: { select: { id: true, name: true } },
        enrollments: { select: { id: true, schoolId: true, status: true, school: { select: { name: true } } } },
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) { next(err); }
};

/**
 * PUT /api/admin/users/:id/role
 * Change user role. Body: { role: "INSTRUCTOR" }
 */
const changeUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const validRoles = ['SUPER_ADMIN', 'OWNER', 'INSTRUCTOR', 'STUDENT',
      'EVENT_COORDINATOR', 'MARKETING', 'SCHOOL_STAFF', 'IT_ADMIN'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'User not found' });

    // Prevent demoting the last SUPER_ADMIN
    if (target.role === 'SUPER_ADMIN' && role !== 'SUPER_ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'SUPER_ADMIN', isActive: true } });
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Cannot demote the last Super Admin' });
      }
    }

    const oldRole = target.role;
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true, email: true, role: true },
    });

    await writeAudit(req.user.id, 'USER_ROLE_CHANGED', 'User', target.id,
      { oldRole, newRole: role, email: target.email }, req);

    res.json(updated);
  } catch (err) { next(err); }
};

/**
 * PUT /api/admin/users/:id/disable
 * Disable (deactivate) a user account.
 */
const disableUser = async (req, res, next) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (!target.isActive) return res.status(400).json({ error: 'User is already disabled' });

    // Prevent disabling self
    if (target.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot disable your own account' });
    }

    // Prevent disabling last SUPER_ADMIN
    if (target.role === 'SUPER_ADMIN') {
      const count = await prisma.user.count({ where: { role: 'SUPER_ADMIN', isActive: true } });
      if (count <= 1) {
        return res.status(400).json({ error: 'Cannot disable the last Super Admin' });
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false, disabledAt: new Date(), disabledBy: req.user.id },
      select: { id: true, email: true, isActive: true, disabledAt: true },
    });

    await writeAudit(req.user.id, 'USER_DISABLED', 'User', target.id,
      { email: target.email, reason: req.body.reason || null }, req);

    res.json(updated);
  } catch (err) { next(err); }
};

/**
 * PUT /api/admin/users/:id/enable
 * Re-enable a disabled user account.
 */
const enableUser = async (req, res, next) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.isActive) return res.status(400).json({ error: 'User is already active' });

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: true, disabledAt: null, disabledBy: null },
      select: { id: true, email: true, isActive: true },
    });

    await writeAudit(req.user.id, 'USER_ENABLED', 'User', target.id,
      { email: target.email }, req);

    res.json(updated);
  } catch (err) { next(err); }
};

/**
 * POST /api/admin/users/:id/reset-password
 * Force reset a user's password. Body: { newPassword }
 */
const resetUserPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'User not found' });

    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.params.id },
      data: { passwordHash: hash },
    });

    await writeAudit(req.user.id, 'USER_PASSWORD_RESET', 'User', target.id,
      { email: target.email }, req);

    res.json({ message: 'Password reset successfully' });
  } catch (err) { next(err); }
};

/**
 * POST /api/admin/users/create
 * Create a user (admin provisioning). Body: { email, password, firstName, lastName, role, schoolId? }
 */
const createUser = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, role, schoolId } = req.body;

    if (!email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({ error: 'email, password, firstName, lastName, and role are required' });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    const hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash: hash,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role,
        schoolId: schoolId || null,
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });

    await writeAudit(req.user.id, 'USER_CREATED', 'User', user.id,
      { email: user.email, role }, req);

    res.status(201).json(user);
  } catch (err) { next(err); }
};

// ─── Audit Logs ──────────────────────────────────────────

/**
 * GET /api/admin/audit-logs
 * Query: ?action=&performerId=&targetType=&from=&to=&page=1&limit=50
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const { action, performerId, targetType, from, to, page = 1, limit = 50 } = req.query;
    const take = Math.min(parseInt(limit, 10) || 50, 200);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

    const where = {};
    if (action) where.action = action;
    if (performerId) where.performerId = performerId;
    if (targetType) where.targetType = targetType;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          performer: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ logs, total, page: parseInt(page, 10) || 1, limit: take });
  } catch (err) { next(err); }
};

// ─── System Settings ─────────────────────────────────────

/**
 * GET /api/admin/settings
 * Query: ?category=
 */
const getSettings = async (req, res, next) => {
  try {
    const { category } = req.query;
    const where = category ? { category } : {};
    const settings = await prisma.systemSetting.findMany({ where, orderBy: { key: 'asc' } });
    res.json(settings);
  } catch (err) { next(err); }
};

/**
 * PUT /api/admin/settings/:key
 * Body: { value, label?, category? }
 */
const upsertSetting = async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value, label, category } = req.body;

    if (value === undefined) return res.status(400).json({ error: 'value is required' });

    const setting = await prisma.systemSetting.upsert({
      where: { key },
      update: { value: String(value), updatedBy: req.user.id, ...(label && { label }), ...(category && { category }) },
      create: { key, value: String(value), updatedBy: req.user.id, label: label || key, category: category || 'general' },
    });

    await writeAudit(req.user.id, 'SETTING_CHANGED', 'SystemSetting', key,
      { key, value: String(value) }, req);

    res.json(setting);
  } catch (err) { next(err); }
};

// ─── Stats Summary ───────────────────────────────────────

/**
 * GET /api/admin/stats
 * Quick summary stats for the admin dashboard.
 */
const getAdminStats = async (req, res, next) => {
  try {
    const [
      totalUsers, activeUsers, disabledUsers,
      roleCounts, recentAudits,
      schoolCount, recentUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isActive: false } }),
      prisma.user.groupBy({ by: ['role'], _count: true }),
      prisma.auditLog.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) } } }),
      prisma.school.count(),
      prisma.user.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60_000) } },
        select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const roleBreakdown = {};
    for (const r of roleCounts) {
      roleBreakdown[r.role] = r._count;
    }

    res.json({
      totalUsers,
      activeUsers,
      disabledUsers,
      roleBreakdown,
      schoolCount,
      auditEventsLast24h: recentAudits,
      recentUsers,
    });
  } catch (err) { next(err); }
};

module.exports = {
  listUsers, getUser, changeUserRole, disableUser, enableUser,
  resetUserPassword, createUser,
  getAuditLogs,
  getSettings, upsertSetting,
  getAdminStats,
};
