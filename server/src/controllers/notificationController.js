const prisma = require('../config/database');
const {
  sendNotification,
  notifySchoolStudents,
  checkBirthdays,
  checkMissedClasses,
  checkPaymentReminders,
  sendWelcomeEmails,
} = require('../services/notificationService');

// ─── Get notifications for current user (in-app inbox) ───

const getMyNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 30, unreadOnly } = req.query;
    const skip = (page - 1) * parseInt(limit);

    const where = { userId: req.user.id };
    if (unreadOnly === 'true') where.readAt = null;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip,
      }),
      prisma.notification.count({ where }),
    ]);

    const unread = await prisma.notification.count({
      where: { userId: req.user.id, readAt: null },
    });

    res.json({ notifications, total, unread, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) { next(error); }
};

// ─── Mark notification(s) as read ────────────────────────

const markRead = async (req, res, next) => {
  try {
    const { ids } = req.body; // array of notification IDs, or 'all'

    if (ids === 'all') {
      await prisma.notification.updateMany({
        where: { userId: req.user.id, readAt: null },
        data: { readAt: new Date() },
      });
    } else if (Array.isArray(ids)) {
      await prisma.notification.updateMany({
        where: { id: { in: ids }, userId: req.user.id },
        data: { readAt: new Date() },
      });
    }

    res.json({ message: 'Marked as read' });
  } catch (error) { next(error); }
};

// ─── Get notification preferences ────────────────────────

const getPreferences = async (req, res, next) => {
  try {
    const prefs = await prisma.notificationPreference.findMany({
      where: { userId: req.user.id },
    });
    res.json(prefs);
  } catch (error) { next(error); }
};

// ─── Update notification preference ──────────────────────

const updatePreference = async (req, res, next) => {
  try {
    const { type, channel, enabled } = req.body;

    const pref = await prisma.notificationPreference.upsert({
      where: { userId_type_channel: { userId: req.user.id, type, channel } },
      create: { userId: req.user.id, type, channel, enabled },
      update: { enabled },
    });

    res.json(pref);
  } catch (error) { next(error); }
};

// ─── Get/manage notification templates (staff) ───────────

const getTemplates = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const templates = await prisma.notificationTemplate.findMany({
      where: { OR: [{ schoolId }, { schoolId: null }] },
      orderBy: [{ type: 'asc' }, { channel: 'asc' }],
    });
    res.json(templates);
  } catch (error) { next(error); }
};

const upsertTemplate = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const { type, channel, subject, body, isActive } = req.body;

    const template = await prisma.notificationTemplate.upsert({
      where: { schoolId_type_channel: { schoolId, type, channel } },
      create: { schoolId, type, channel, subject, body, isActive: isActive !== false },
      update: { subject, body, ...(isActive !== undefined && { isActive }) },
    });

    res.json(template);
  } catch (error) { next(error); }
};

// ─── Send a notification (staff) ─────────────────────────

const sendManualNotification = async (req, res, next) => {
  try {
    const { userId, schoolId, type, channel, subject, body } = req.body;

    if (userId === 'all_students' && schoolId) {
      const results = await notifySchoolStudents(schoolId, type || 'GENERAL', { subject, body }, channel || 'IN_APP');
      return res.json({ sent: results.length });
    }

    const notification = await sendNotification({
      userId,
      schoolId,
      type: type || 'GENERAL',
      channel: channel || 'IN_APP',
      vars: { subject, body },
    });

    res.json(notification);
  } catch (error) { next(error); }
};

// ─── Get school notification log (staff) ─────────────────

const getSchoolNotifications = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const { page = 1, limit = 50, type } = req.query;
    const skip = (page - 1) * parseInt(limit);

    const where = { schoolId };
    if (type) where.type = type;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip,
      }),
      prisma.notification.count({ where }),
    ]);

    res.json({ notifications, total, page: parseInt(page) });
  } catch (error) { next(error); }
};

// ─── Manual trigger for scheduled jobs (Super Admin) ─────

const triggerScheduledJobs = async (req, res, next) => {
  try {
    const { job } = req.body;
    const results = {};

    if (!job || job === 'birthdays') { await checkBirthdays(); results.birthdays = 'done'; }
    if (!job || job === 'missed_class') { await checkMissedClasses(); results.missedClass = 'done'; }
    if (!job || job === 'payment_reminders') { await checkPaymentReminders(); results.paymentReminders = 'done'; }
    if (!job || job === 'welcome') { await sendWelcomeEmails(); results.welcome = 'done'; }

    res.json({ message: 'Scheduled jobs triggered', results });
  } catch (error) { next(error); }
};

module.exports = {
  getMyNotifications,
  markRead,
  getPreferences,
  updatePreference,
  getTemplates,
  upsertTemplate,
  sendManualNotification,
  getSchoolNotifications,
  triggerScheduledJobs,
};
