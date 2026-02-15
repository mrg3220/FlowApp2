const prisma = require('../config/database');
const { calculateNextInvoiceDate, generateAutoInvoices, markOverdueInvoices } = require('../services/autoInvoice');

// ─────────────────────────────────────────────────────────
// Payment Config — per-school gateway setup
// ─────────────────────────────────────────────────────────

/**
 * GET /api/billing/config/:schoolId
 * Get billing config for a school (owner of that school or SUPER_ADMIN)
 */
const getPaymentConfig = async (req, res, next) => {
  try {
    const { schoolId } = req.params;

    // Access check
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) return res.status(404).json({ error: 'School not found' });
    if (req.user.role === 'OWNER' && school.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let config = await prisma.paymentConfig.findUnique({ where: { schoolId } });

    if (!config) {
      // Return sensible defaults
      config = {
        schoolId,
        gateway: 'MANUAL',
        currency: 'USD',
        taxRate: 0,
        lateFeeAmount: 0,
        gracePeriodDays: 7,
        isActive: false,
        gatewayPublicKey: null,
        gatewaySecretKey: null,
        gatewayMerchantId: null,
      };
    } else {
      // Mask secret key for response
      config = {
        ...config,
        gatewaySecretKey: config.gatewaySecretKey ? '••••••••' : null,
      };
    }

    res.json(config);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/billing/config/:schoolId
 * Create or update billing config for a school
 */
const upsertPaymentConfig = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const {
      gateway,
      gatewayPublicKey,
      gatewaySecretKey,
      gatewayMerchantId,
      currency,
      taxRate,
      lateFeeAmount,
      gracePeriodDays,
      isActive,
    } = req.body;

    // Access check
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) return res.status(404).json({ error: 'School not found' });
    if (req.user.role === 'OWNER' && school.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Build the data — only update secretKey if a new non-masked value is provided
    const data = {};
    if (gateway !== undefined) data.gateway = gateway;
    if (gatewayPublicKey !== undefined) data.gatewayPublicKey = gatewayPublicKey;
    if (gatewaySecretKey && gatewaySecretKey !== '••••••••') data.gatewaySecretKey = gatewaySecretKey;
    if (gatewayMerchantId !== undefined) data.gatewayMerchantId = gatewayMerchantId;
    if (currency !== undefined) data.currency = currency;
    if (taxRate !== undefined) data.taxRate = parseFloat(taxRate);
    if (lateFeeAmount !== undefined) data.lateFeeAmount = parseFloat(lateFeeAmount);
    if (gracePeriodDays !== undefined) data.gracePeriodDays = parseInt(gracePeriodDays, 10);
    if (isActive !== undefined) data.isActive = isActive;

    const config = await prisma.paymentConfig.upsert({
      where: { schoolId },
      create: { schoolId, ...data },
      update: data,
    });

    res.json({
      ...config,
      gatewaySecretKey: config.gatewaySecretKey ? '••••••••' : null,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────
// Membership Plans — per-school pricing
// ─────────────────────────────────────────────────────────

/**
 * GET /api/billing/plans/:schoolId
 */
const getPlans = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const { all } = req.query; // ?all=true to include inactive

    const where = { schoolId };
    if (!all) where.isActive = true;

    const plans = await prisma.membershipPlan.findMany({
      where,
      orderBy: { price: 'asc' },
    });

    res.json(plans);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/billing/plans/:schoolId
 */
const createPlan = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const { name, description, price, billingCycle, classCredits } = req.body;

    // Access check
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) return res.status(404).json({ error: 'School not found' });
    if (req.user.role === 'OWNER' && school.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const plan = await prisma.membershipPlan.create({
      data: {
        schoolId,
        name,
        description: description || null,
        price: parseFloat(price),
        billingCycle: billingCycle || 'MONTHLY',
        classCredits: classCredits ? parseInt(classCredits, 10) : null,
      },
    });

    res.status(201).json(plan);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/billing/plans/:schoolId/:planId
 */
const updatePlan = async (req, res, next) => {
  try {
    const { schoolId, planId } = req.params;
    const { name, description, price, billingCycle, classCredits, isActive } = req.body;

    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) return res.status(404).json({ error: 'School not found' });
    if (req.user.role === 'OWNER' && school.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const existing = await prisma.membershipPlan.findFirst({
      where: { id: planId, schoolId },
    });
    if (!existing) return res.status(404).json({ error: 'Plan not found' });

    const plan = await prisma.membershipPlan.update({
      where: { id: planId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(billingCycle !== undefined && { billingCycle }),
        ...(classCredits !== undefined && { classCredits: classCredits ? parseInt(classCredits, 10) : null }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json(plan);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/billing/plans/:schoolId/:planId  (soft-delete)
 */
const deletePlan = async (req, res, next) => {
  try {
    const { schoolId, planId } = req.params;

    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) return res.status(404).json({ error: 'School not found' });
    if (req.user.role === 'OWNER' && school.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.membershipPlan.update({
      where: { id: planId },
      data: { isActive: false },
    });

    res.json({ message: 'Plan deactivated' });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────
// Invoices
// ─────────────────────────────────────────────────────────

/**
 * Generate next invoice number for a school.
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
 * GET /api/billing/invoices/:schoolId
 */
const getInvoices = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const { status, studentId } = req.query;

    // Students can only see their own invoices
    const where = { schoolId };
    if (req.user.role === 'STUDENT') {
      where.studentId = req.user.id;
    } else if (studentId) {
      where.studentId = studentId;
    }
    if (status) where.status = status;

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
        plan: { select: { id: true, name: true } },
        _count: { select: { payments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(invoices);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/billing/invoices/:schoolId
 * Create an invoice for a student.
 */
const createInvoice = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const { studentId, planId, subtotal, notes, dueDate } = req.body;

    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) return res.status(404).json({ error: 'School not found' });
    if (req.user.role === 'OWNER' && school.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Resolve price from plan if planId is provided
    let resolvedSubtotal = parseFloat(subtotal || 0);
    if (planId) {
      const plan = await prisma.membershipPlan.findFirst({ where: { id: planId, schoolId } });
      if (!plan) return res.status(404).json({ error: 'Plan not found' });
      resolvedSubtotal = plan.price;
    }

    // Get tax rate from school config
    const paymentConfig = await prisma.paymentConfig.findUnique({ where: { schoolId } });
    const taxRate = paymentConfig?.taxRate || 0;
    const taxAmount = resolvedSubtotal * (taxRate / 100);
    const totalAmount = resolvedSubtotal + taxAmount;

    const invoiceNumber = await nextInvoiceNumber(schoolId);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        schoolId,
        studentId,
        planId: planId || null,
        subtotal: resolvedSubtotal,
        taxAmount: Math.round(taxAmount * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        status: 'SENT',
        dueDate: new Date(dueDate || Date.now() + 30 * 24 * 60 * 60 * 1000),
        notes: notes || null,
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
        plan: { select: { id: true, name: true } },
      },
    });

    res.status(201).json(invoice);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/billing/invoices/:schoolId/:invoiceId/status
 */
const updateInvoiceStatus = async (req, res, next) => {
  try {
    const { schoolId, invoiceId } = req.params;
    const { status } = req.body;

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, schoolId },
    });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status,
        ...(status === 'PAID' && { paidAt: new Date() }),
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────
// Payments
// ─────────────────────────────────────────────────────────

/**
 * POST /api/billing/payments/:schoolId
 * Record a payment against an invoice.
 */
const recordPayment = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const { invoiceId, amount, method, notes, token } = req.body;

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, schoolId },
    });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    let gatewayTransactionId = null;

    // If method is GATEWAY, attempt to process through the school's payment provider
    if (method === 'GATEWAY' && token) {
      const paymentConfig = await prisma.paymentConfig.findUnique({ where: { schoolId } });
      const { getAdapter } = require('../services/paymentGateway');
      const adapter = getAdapter(paymentConfig);

      const result = await adapter.charge(paymentConfig, {
        amount: parseFloat(amount),
        currency: paymentConfig?.currency,
        description: `Invoice ${invoice.invoiceNumber}`,
        token,
      });

      if (!result.success) {
        return res.status(402).json({ error: result.error || 'Payment processing failed' });
      }

      gatewayTransactionId = result.transactionId;
    }

    const paymentAmount = parseFloat(amount);

    const payment = await prisma.payment.create({
      data: {
        invoiceId,
        studentId: invoice.studentId,
        amount: paymentAmount,
        method: method || 'CASH',
        gatewayTransactionId,
        recordedById: req.user.role !== 'STUDENT' ? req.user.id : null,
        notes: notes || null,
      },
    });

    // Check if invoice is fully paid
    const totalPaid = await prisma.payment.aggregate({
      where: { invoiceId },
      _sum: { amount: true },
    });

    if ((totalPaid._sum.amount || 0) >= invoice.totalAmount) {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'PAID', paidAt: new Date() },
      });
    }

    res.status(201).json(payment);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/billing/payments/:schoolId
 */
const getPayments = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const { invoiceId, studentId } = req.query;

    const where = {};
    if (invoiceId) where.invoiceId = invoiceId;

    // Scope payments through invoices that belong to this school
    where.invoice = { schoolId };

    if (req.user.role === 'STUDENT') {
      where.studentId = req.user.id;
    } else if (studentId) {
      where.studentId = studentId;
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        invoice: { select: { id: true, invoiceNumber: true, totalAmount: true } },
        student: { select: { id: true, firstName: true, lastName: true } },
        recordedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { paidAt: 'desc' },
    });

    res.json(payments);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/billing/summary/:schoolId
 * Billing summary / dashboard for a school
 */
const getBillingSummary = async (req, res, next) => {
  try {
    const { schoolId } = req.params;

    const [
      totalRevenue,
      monthlyRevenue,
      outstandingInvoices,
      overdueInvoices,
      activePlans,
      recentPayments,
    ] = await Promise.all([
      // Total revenue all time
      prisma.payment.aggregate({
        where: { invoice: { schoolId } },
        _sum: { amount: true },
      }),
      // Revenue this month
      prisma.payment.aggregate({
        where: {
          invoice: { schoolId },
          paidAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
        _sum: { amount: true },
      }),
      // Outstanding (SENT) invoices
      prisma.invoice.aggregate({
        where: { schoolId, status: 'SENT' },
        _count: true,
        _sum: { totalAmount: true },
      }),
      // Overdue invoices
      prisma.invoice.aggregate({
        where: { schoolId, status: 'PAST_DUE' },
        _count: true,
        _sum: { totalAmount: true },
      }),
      // Active plans count
      prisma.membershipPlan.count({ where: { schoolId, isActive: true } }),
      // Last 5 payments
      prisma.payment.findMany({
        where: { invoice: { schoolId } },
        include: {
          invoice: { select: { invoiceNumber: true } },
          student: { select: { firstName: true, lastName: true } },
        },
        orderBy: { paidAt: 'desc' },
        take: 5,
      }),
    ]);

    res.json({
      totalRevenue: totalRevenue._sum.amount || 0,
      monthlyRevenue: monthlyRevenue._sum.amount || 0,
      outstanding: {
        count: outstandingInvoices._count || 0,
        amount: outstandingInvoices._sum.totalAmount || 0,
      },
      overdue: {
        count: overdueInvoices._count || 0,
        amount: overdueInvoices._sum.totalAmount || 0,
      },
      activePlans,
      recentPayments,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPaymentConfig,
  upsertPaymentConfig,
  getPlans,
  createPlan,
  updatePlan,
  deletePlan,
  getInvoices,
  createInvoice,
  updateInvoiceStatus,
  recordPayment,
  getPayments,
  getBillingSummary,
  getSubscriptions,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  triggerAutoInvoice,
};

// ─────────────────────────────────────────────────────────
// Subscriptions — student ↔ plan assignment with auto-invoicing
// ─────────────────────────────────────────────────────────

/**
 * GET /api/billing/subscriptions/:schoolId
 * List subscriptions for a school (optionally filter by status, studentId)
 */
async function getSubscriptions(req, res, next) {
  try {
    const { schoolId } = req.params;
    const { status, studentId } = req.query;

    const where = { schoolId };
    if (status) where.status = status;

    // Students only see their own
    if (req.user.role === 'STUDENT') {
      where.studentId = req.user.id;
    } else if (studentId) {
      where.studentId = studentId;
    }

    const subscriptions = await prisma.subscription.findMany({
      where,
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
        plan: { select: { id: true, name: true, price: true, billingCycle: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(subscriptions);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/billing/subscriptions/:schoolId
 * Create a subscription — assign a student to a plan with auto-invoicing
 */
async function createSubscription(req, res, next) {
  try {
    const { schoolId } = req.params;
    const { studentId, planId, startDate } = req.body;

    // Access check
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) return res.status(404).json({ error: 'School not found' });
    if (req.user.role === 'OWNER' && school.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate plan belongs to school
    const plan = await prisma.membershipPlan.findFirst({
      where: { id: planId, schoolId, isActive: true },
    });
    if (!plan) return res.status(404).json({ error: 'Active plan not found for this school' });

    // Validate student is enrolled at this school
    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId, schoolId, status: 'ACTIVE' },
    });
    if (!enrollment) {
      return res.status(400).json({ error: 'Student is not actively enrolled at this school' });
    }

    // Check for existing active subscription to same plan
    const existing = await prisma.subscription.findFirst({
      where: { studentId, planId, schoolId, status: 'ACTIVE' },
    });
    if (existing) {
      return res.status(409).json({ error: 'Student already has an active subscription to this plan' });
    }

    // Calculate first invoice date: next 1st of the month
    const now = new Date();
    const start = startDate ? new Date(startDate) : now;
    let nextInvoiceDate;
    if (start.getDate() === 1) {
      // If starting on the 1st, invoice immediately (next cron run)
      nextInvoiceDate = start;
    } else {
      // Otherwise, first invoice on the 1st of next month
      nextInvoiceDate = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    }

    const subscription = await prisma.subscription.create({
      data: {
        studentId,
        planId,
        schoolId,
        startDate: start,
        nextInvoiceDate,
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
        plan: { select: { id: true, name: true, price: true, billingCycle: true } },
      },
    });

    res.status(201).json(subscription);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Subscription already exists' });
    }
    next(error);
  }
}

/**
 * PATCH /api/billing/subscriptions/:schoolId/:subscriptionId
 * Update a subscription (pause, resume, change plan)
 */
async function updateSubscription(req, res, next) {
  try {
    const { schoolId, subscriptionId } = req.params;
    const { status, planId } = req.body;

    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) return res.status(404).json({ error: 'School not found' });
    if (req.user.role === 'OWNER' && school.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const sub = await prisma.subscription.findFirst({
      where: { id: subscriptionId, schoolId },
    });
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });

    const data = {};

    if (status) {
      data.status = status;
      // If resuming from PAUSED, recalculate nextInvoiceDate
      if (status === 'ACTIVE' && sub.status === 'PAUSED') {
        const now = new Date();
        data.nextInvoiceDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      }
      // If pausing, clear nextInvoiceDate to stop auto-invoicing
      if (status === 'PAUSED') {
        data.nextInvoiceDate = null;
      }
    }

    if (planId && planId !== sub.planId) {
      const plan = await prisma.membershipPlan.findFirst({
        where: { id: planId, schoolId, isActive: true },
      });
      if (!plan) return res.status(404).json({ error: 'Plan not found' });
      data.planId = planId;
    }

    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data,
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
        plan: { select: { id: true, name: true, price: true, billingCycle: true } },
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/billing/subscriptions/:schoolId/:subscriptionId
 * Cancel a subscription (soft — sets status to CANCELLED + endDate)
 */
async function cancelSubscription(req, res, next) {
  try {
    const { schoolId, subscriptionId } = req.params;

    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) return res.status(404).json({ error: 'School not found' });
    if (req.user.role === 'OWNER' && school.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const sub = await prisma.subscription.findFirst({
      where: { id: subscriptionId, schoolId },
    });
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });

    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'CANCELLED',
        endDate: new Date(),
        nextInvoiceDate: null,
      },
    });

    res.json({ message: 'Subscription cancelled' });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/billing/auto-invoice/run
 * Manually trigger auto-invoice generation (SUPER_ADMIN only)
 */
async function triggerAutoInvoice(req, res, next) {
  try {
    const [invoiceResult, overdueCount] = await Promise.all([
      generateAutoInvoices(),
      markOverdueInvoices(),
    ]);

    res.json({
      message: 'Auto-invoice run complete',
      invoicesGenerated: invoiceResult.generated,
      invoiceErrors: invoiceResult.errors,
      overdueMarked: overdueCount,
      details: invoiceResult.details,
    });
  } catch (error) {
    next(error);
  }
}
