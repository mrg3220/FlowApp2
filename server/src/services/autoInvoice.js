/**
 * Auto-Invoicing Service
 *
 * Runs on a cron schedule (1st of every month at midnight) and generates
 * invoices for all active subscriptions whose nextInvoiceDate has arrived.
 *
 * Can also be triggered manually via POST /api/billing/auto-invoice/run
 */
const cron = require('node-cron');
const prisma = require('../config/database');

/**
 * Calculate the next invoice date based on a billing cycle.
 * Moves forward from `fromDate` by one cycle period.
 */
function calculateNextInvoiceDate(fromDate, billingCycle) {
  const d = new Date(fromDate);
  switch (billingCycle) {
    case 'WEEKLY':
      d.setDate(d.getDate() + 7);
      break;
    case 'MONTHLY':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'QUARTERLY':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'SEMI_ANNUAL':
      d.setMonth(d.getMonth() + 6);
      break;
    case 'ANNUAL':
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      d.setMonth(d.getMonth() + 1);
  }
  return d;
}

/**
 * Generate the next invoice number for a school in a given year.
 */
async function nextInvoiceNumber(schoolId) {
  const year = new Date().getFullYear();
  const count = await prisma.invoice.count({
    where: {
      schoolId,
      invoiceNumber: { startsWith: `INV-${year}` },
    },
  });
  return `INV-${year}-${String(count + 1).padStart(4, '0')}`;
}

/**
 * Generate invoices for all active subscriptions whose nextInvoiceDate <= now.
 * Returns a summary of what was generated.
 */
async function generateAutoInvoices() {
  const now = new Date();
  console.log(`[AutoInvoice] Running auto-invoice generation at ${now.toISOString()}`);

  // Find all active subscriptions due for invoicing
  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      nextInvoiceDate: { lte: now },
    },
    include: {
      plan: true,
      student: { select: { id: true, firstName: true, lastName: true, email: true } },
      school: { select: { id: true, name: true } },
    },
  });

  if (subscriptions.length === 0) {
    console.log('[AutoInvoice] No subscriptions due for invoicing.');
    return { generated: 0, errors: 0, details: [] };
  }

  console.log(`[AutoInvoice] Found ${subscriptions.length} subscriptions to invoice.`);

  let generated = 0;
  let errors = 0;
  const details = [];

  for (const sub of subscriptions) {
    try {
      // Get school's tax rate
      const paymentConfig = await prisma.paymentConfig.findUnique({
        where: { schoolId: sub.schoolId },
      });
      const taxRate = paymentConfig?.taxRate || 0;

      const subtotal = sub.plan.price;
      const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
      const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

      const invoiceNumber = await nextInvoiceNumber(sub.schoolId);

      // Due date = end of the current month (last day)
      const dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          schoolId: sub.schoolId,
          studentId: sub.studentId,
          planId: sub.planId,
          subtotal,
          taxAmount,
          totalAmount,
          status: 'SENT',
          dueDate,
          notes: `Auto-generated for ${sub.plan.name} subscription`,
        },
      });

      // Advance the subscription's nextInvoiceDate
      const nextDate = calculateNextInvoiceDate(sub.nextInvoiceDate, sub.plan.billingCycle);
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { nextInvoiceDate: nextDate },
      });

      generated++;
      details.push({
        invoiceNumber,
        student: `${sub.student.firstName} ${sub.student.lastName}`,
        school: sub.school.name,
        plan: sub.plan.name,
        total: totalAmount,
        nextInvoiceDate: nextDate.toISOString(),
      });

      console.log(`[AutoInvoice] Created ${invoiceNumber} for ${sub.student.firstName} ${sub.student.lastName} — $${totalAmount}`);
    } catch (err) {
      errors++;
      console.error(`[AutoInvoice] Error processing subscription ${sub.id}:`, err.message);
    }
  }

  console.log(`[AutoInvoice] Complete: ${generated} invoices generated, ${errors} errors.`);
  return { generated, errors, details };
}

/**
 * Mark overdue invoices — invoices past their due date that are still SENT.
 */
async function markOverdueInvoices() {
  const now = new Date();
  const result = await prisma.invoice.updateMany({
    where: {
      status: 'SENT',
      dueDate: { lt: now },
    },
    data: { status: 'PAST_DUE' },
  });

  if (result.count > 0) {
    console.log(`[AutoInvoice] Marked ${result.count} invoices as PAST_DUE.`);
  }
  return result.count;
}

/**
 * Start the cron scheduler.
 * - 1st of every month at 00:05 → generate auto-invoices
 * - Daily at 01:00 → mark overdue invoices
 */
function startScheduler() {
  // Generate invoices on the 1st of every month at 00:05
  cron.schedule('5 0 1 * *', async () => {
    try {
      await generateAutoInvoices();
    } catch (err) {
      console.error('[AutoInvoice] Scheduler error (invoice generation):', err);
    }
  });

  // Check for overdue invoices daily at 1 AM
  cron.schedule('0 1 * * *', async () => {
    try {
      await markOverdueInvoices();
    } catch (err) {
      console.error('[AutoInvoice] Scheduler error (overdue check):', err);
    }
  });

  console.log('📅 Auto-invoice scheduler started (1st of month @ 00:05, overdue check daily @ 01:00)');
}

module.exports = {
  generateAutoInvoices,
  markOverdueInvoices,
  calculateNextInvoiceDate,
  startScheduler,
};
