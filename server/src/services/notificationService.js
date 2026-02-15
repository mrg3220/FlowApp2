/**
 * Notification Service
 * Handles sending notifications via EMAIL, SMS, and IN_APP channels.
 * Uses placeholder transports (mock) — swap in SendGrid/Twilio later.
 */
const prisma = require('../config/database');
const logger = require('../utils/logger'); // EA Standard: Structured logging

// ─── Template variable replacer ──────────────────────────
function interpolate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

// ─── Channel transports (placeholders) ───────────────────

async function sendEmail(to, subject, body) {
  logger.info(`📧 [MOCK EMAIL] To: ${to} | Subject: ${subject}`);
  // Mock success for testing/dev environments
  return Promise.resolve(true); 
}

async function sendSMS(to, body) {
  logger.info(`📱 [MOCK SMS] To: ${to} | Body: ${body.substring(0, 60)}...`);
  // Mock success for testing/dev environments
  return Promise.resolve(true);
}


// ─── Core send function ──────────────────────────────────

/**
 * Send a notification to a user.
 * @param {Object} opts
 * @param {string} opts.userId
 * @param {string} opts.schoolId
 * @param {string} opts.type        - NotificationType enum
 * @param {string} opts.channel     - EMAIL | SMS | IN_APP
 * @param {Object} opts.vars        - template variables
 * @param {Object} opts.metadata    - extra JSON stored with notification
 */
async function sendNotification({ userId, schoolId, type, channel = 'IN_APP', vars = {}, metadata = null }) {
  try {
    // Check user preference
    const pref = await prisma.notificationPreference.findUnique({
      where: { userId_type_channel: { userId, type, channel } },
    });
    if (pref && !pref.enabled) return null; // user opted out

    // Try to find a template
    const template = await prisma.notificationTemplate.findFirst({
      where: {
        type,
        channel,
        isActive: true,
        OR: [{ schoolId }, { schoolId: null }],
      },
      orderBy: { schoolId: 'desc' }, // school-specific first
    });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    const allVars = { firstName: user.firstName, lastName: user.lastName, email: user.email, ...vars };
    const subject = template?.subject ? interpolate(template.subject, allVars) : vars.subject || type.replace(/_/g, ' ');
    const body = template?.body ? interpolate(template.body, allVars) : vars.body || `Notification: ${type}`;

    // Create the notification record
    const notification = await prisma.notification.create({
      data: {
        userId,
        schoolId: schoolId || null,
        type,
        channel,
        subject,
        body,
        metadata: metadata || undefined,
        sentAt: channel !== 'IN_APP' ? new Date() : null,
      },
    });

    // Dispatch to transport
    if (channel === 'EMAIL' && user.email) {
      await sendEmail(user.email, subject, body);
      await prisma.notification.update({ where: { id: notification.id }, data: { sentAt: new Date() } });
    } else if (channel === 'SMS' && user.phone) {
      await sendSMS(user.phone, body);
      await prisma.notification.update({ where: { id: notification.id }, data: { sentAt: new Date() } });
    }
    // IN_APP is stored only — no external send

    return notification;
  } catch (error) {
    logger.error(`Notification error (${type}/${channel} → ${userId}): ${error.message}`);
    return null;
  }
}

// ─── Batch helpers ───────────────────────────────────────

/**
 * Send notification to all students at a school
 */
async function notifySchoolStudents(schoolId, type, vars, channel = 'IN_APP') {
  const enrollments = await prisma.enrollment.findMany({
    where: { schoolId, status: 'ACTIVE' },
    select: { studentId: true },
  });
  const results = [];
  for (const e of enrollments) {
    const n = await sendNotification({ userId: e.studentId, schoolId, type, channel, vars });
    if (n) results.push(n);
  }
  return results;
}

// ─── Scheduled jobs ──────────────────────────────────────

/**
 * Birthday check — find users with birthday today, send greeting.
 */
async function checkBirthdays() {
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  const users = await prisma.$queryRaw`
    SELECT id, first_name, email FROM users
    WHERE date_of_birth IS NOT NULL
      AND EXTRACT(MONTH FROM date_of_birth) = ${month}
      AND EXTRACT(DAY FROM date_of_birth) = ${day}
  `;

  for (const u of users) {
    await sendNotification({
      userId: u.id,
      type: 'BIRTHDAY',
      channel: 'EMAIL',
      vars: { subject: '🎂 Happy Birthday, {{firstName}}!', body: 'Happy Birthday, {{firstName}}! Your martial arts family wishes you a fantastic day! 🥋🎉' },
    });
    await sendNotification({
      userId: u.id,
      type: 'BIRTHDAY',
      channel: 'IN_APP',
      vars: { body: '🎂 Happy Birthday! Your martial arts family wishes you a great day!' },
    });
  }
  logger.info(`🎂 Birthday check: ${users.length} users`);
}

/**
 * Missed-class alert — students who haven't checked in for 7+ days.
 */
async function checkMissedClasses() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Find active students with no check-in in the past week
  const students = await prisma.$queryRaw`
    SELECT DISTINCT e.student_id, e.school_id
    FROM enrollments e
    WHERE e.status = 'ACTIVE'
      AND NOT EXISTS (
        SELECT 1 FROM check_ins ci
        WHERE ci.student_id = e.student_id
          AND ci.checked_in_at > ${sevenDaysAgo}
      )
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = e.student_id
          AND n.type = 'MISSED_CLASS'
          AND n.created_at > ${sevenDaysAgo}
      )
  `;

  for (const s of students) {
    await sendNotification({
      userId: s.student_id,
      schoolId: s.school_id,
      type: 'MISSED_CLASS',
      channel: 'EMAIL',
      vars: {
        subject: 'We miss you at class, {{firstName}}!',
        body: 'Hey {{firstName}}, we noticed you haven\'t been to class in a while. We\'d love to see you back on the mat! 🥋',
      },
    });
    await sendNotification({
      userId: s.student_id,
      schoolId: s.school_id,
      type: 'MISSED_CLASS',
      channel: 'IN_APP',
      vars: { body: 'We miss you! It\'s been a while since your last class. Come back soon! 🥋' },
    });
  }
  logger.info(`📋 Missed-class check: ${students.length} students alerted`);
}

/**
 * Payment reminders — invoices due within 3 days.
 */
async function checkPaymentReminders() {
  const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const now = new Date();

  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: ['SENT', 'PAST_DUE'] },
      dueDate: { lte: threeDaysFromNow, gte: now },
    },
    include: { student: true, school: true },
  });

  for (const inv of invoices) {
    const exists = await prisma.notification.findFirst({
      where: {
        userId: inv.studentId,
        type: 'PAYMENT_REMINDER',
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        metadata: { path: ['invoiceId'], equals: inv.id },
      },
    });
    if (exists) continue;

    await sendNotification({
      userId: inv.studentId,
      schoolId: inv.schoolId,
      type: 'PAYMENT_REMINDER',
      channel: 'EMAIL',
      vars: {
        subject: 'Payment reminder — ${{amount}} due {{dueDate}}',
        amount: Number(inv.amount).toFixed(2),
        dueDate: inv.dueDate.toLocaleDateString(),
        body: 'Hi {{firstName}}, your payment of ${{amount}} is due on {{dueDate}}. Please make your payment at your earliest convenience.',
      },
      metadata: { invoiceId: inv.id },
    });
    await sendNotification({
      userId: inv.studentId,
      schoolId: inv.schoolId,
      type: 'PAYMENT_REMINDER',
      channel: 'IN_APP',
      vars: {
        body: '💰 Payment reminder: $' + Number(inv.amount).toFixed(2) + ' due ' + inv.dueDate.toLocaleDateString(),
      },
      metadata: { invoiceId: inv.id },
    });
  }
  logger.info(`💰 Payment reminders: ${invoices.length} invoices checked`);
}

/**
 * Welcome sequence — send welcome email to users created in the last 24h
 * who haven't received a welcome notification yet.
 */
async function sendWelcomeEmails() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const newUsers = await prisma.user.findMany({
    where: {
      createdAt: { gte: yesterday },
      NOT: {
        notifications: { some: { type: 'WELCOME' } },
      },
    },
  });

  for (const u of newUsers) {
    await sendNotification({
      userId: u.id,
      type: 'WELCOME',
      channel: 'EMAIL',
      vars: {
        subject: 'Welcome to FlowApp, {{firstName}}! 🥋',
        body: 'Welcome, {{firstName}}! We\'re thrilled to have you join FlowApp. Explore your classes, track your progress, and keep pushing forward. See you on the mat!',
      },
    });
    await sendNotification({
      userId: u.id,
      type: 'WELCOME',
      channel: 'IN_APP',
      vars: { body: '👋 Welcome to FlowApp! Check out your dashboard to get started.' },
    });
  }
  logger.info(`👋 Welcome emails: ${newUsers.length} new users`);
}

module.exports = {
  sendNotification,
  notifySchoolStudents,
  checkBirthdays,
  checkMissedClasses,
  checkPaymentReminders,
  sendWelcomeEmails,
  interpolate,
  startNotificationScheduler,
};

/**
 * Start cron jobs for automated notifications.
 */
function startNotificationScheduler() {
  const cron = require('node-cron');

  // Birthdays — daily at 8:00 AM
  cron.schedule('0 8 * * *', () => {
    logger.info('🎂 Running birthday check...');
    checkBirthdays().catch(err => logger.error(`Birthday check error: ${err.message}`));
  });

  // Missed-class alerts — daily at 9:00 AM
  cron.schedule('0 9 * * *', () => {
    logger.info('🚫 Running missed-class check...');
    checkMissedClasses().catch(err => logger.error(`Missed-class check error: ${err.message}`));
  });

  // Payment reminders — daily at 10:00 AM
  cron.schedule('0 10 * * *', () => {
    logger.info('💰 Running payment reminder check...');
    checkPaymentReminders().catch(err => logger.error(`Payment reminder check error: ${err.message}`));
  });

  // Welcome emails — every hour
  cron.schedule('0 * * * *', () => {
    logger.info('👋 Running welcome email check...');
    sendWelcomeEmails().catch(err => logger.error(`Welcome email check error: ${err.message}`));
  });

  logger.info('🔔 Notification scheduler started');
}
