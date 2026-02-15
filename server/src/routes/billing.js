const express = require('express');
const { body } = require('express-validator');
const {
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
} = require('../controllers/billingController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.use(authenticate);

// ─── Payment Config (per-school gateway setup) ───────────
router.get(
  '/config/:schoolId',
  authorize('SUPER_ADMIN', 'OWNER'),
  getPaymentConfig
);

router.put(
  '/config/:schoolId',
  authorize('SUPER_ADMIN', 'OWNER'),
  [body('gateway').optional().isIn(['STRIPE', 'SQUARE', 'MANUAL']).withMessage('Invalid gateway')],
  validate,
  upsertPaymentConfig
);

// ─── Membership Plans (per-school pricing) ───────────────
router.get(
  '/plans/:schoolId',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR', 'STUDENT'),
  getPlans
);

router.post(
  '/plans/:schoolId',
  authorize('SUPER_ADMIN', 'OWNER'),
  [
    body('name').notEmpty().withMessage('Plan name is required'),
    body('price').isFloat({ min: 0 }).withMessage('Valid price is required'),
  ],
  validate,
  createPlan
);

router.put(
  '/plans/:schoolId/:planId',
  authorize('SUPER_ADMIN', 'OWNER'),
  updatePlan
);

router.delete(
  '/plans/:schoolId/:planId',
  authorize('SUPER_ADMIN', 'OWNER'),
  deletePlan
);

// ─── Invoices ────────────────────────────────────────────
router.get(
  '/invoices/:schoolId',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR', 'STUDENT'),
  getInvoices
);

router.post(
  '/invoices/:schoolId',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'),
  [
    body('studentId').isUUID().withMessage('Valid student ID is required'),
    body('dueDate').optional().isISO8601().withMessage('Valid due date required'),
  ],
  validate,
  createInvoice
);

router.patch(
  '/invoices/:schoolId/:invoiceId/status',
  authorize('SUPER_ADMIN', 'OWNER'),
  [body('status').isIn(['DRAFT', 'SENT', 'PAID', 'PAST_DUE', 'CANCELLED', 'REFUNDED']).withMessage('Invalid status')],
  validate,
  updateInvoiceStatus
);

// ─── Payments ────────────────────────────────────────────
router.get(
  '/payments/:schoolId',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR', 'STUDENT'),
  getPayments
);

router.post(
  '/payments/:schoolId',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR', 'STUDENT'),
  [
    body('invoiceId').isUUID().withMessage('Valid invoice ID is required'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Valid amount is required'),
    body('method').isIn(['CARD', 'CASH', 'CHECK', 'BANK_TRANSFER', 'GATEWAY']).withMessage('Invalid payment method'),
  ],
  validate,
  recordPayment
);

// ─── Summary ─────────────────────────────────────────────
router.get(
  '/summary/:schoolId',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR'),
  getBillingSummary
);

// ─── Subscriptions (student ↔ plan assignment) ───────────
router.get(
  '/subscriptions/:schoolId',
  authorize('SUPER_ADMIN', 'OWNER', 'INSTRUCTOR', 'STUDENT'),
  getSubscriptions
);

router.post(
  '/subscriptions/:schoolId',
  authorize('SUPER_ADMIN', 'OWNER'),
  [
    body('studentId').isUUID().withMessage('Valid student ID is required'),
    body('planId').isUUID().withMessage('Valid plan ID is required'),
  ],
  validate,
  createSubscription
);

router.patch(
  '/subscriptions/:schoolId/:subscriptionId',
  authorize('SUPER_ADMIN', 'OWNER'),
  updateSubscription
);

router.delete(
  '/subscriptions/:schoolId/:subscriptionId',
  authorize('SUPER_ADMIN', 'OWNER'),
  cancelSubscription
);

// ─── Auto-Invoice Manual Trigger ─────────────────────────
router.post(
  '/auto-invoice/run',
  authorize('SUPER_ADMIN'),
  triggerAutoInvoice
);

module.exports = router;
