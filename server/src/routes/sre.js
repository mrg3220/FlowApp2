/**
 * ──────────────────────────────────────────────────────────
 * SRE / Observability Routes
 * ──────────────────────────────────────────────────────────
 * All endpoints require SUPER_ADMIN or IT_ADMIN role.
 * ──────────────────────────────────────────────────────────
 */

const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const {
  getSystemHealth, getDatabaseMetrics, getRequestMetrics,
  getRecentErrors, getRuntimeInfo, getSREDashboard,
} = require('../controllers/sreController');

const router = express.Router();

// All SRE routes require auth + admin role
router.use(authenticate, authorize('SUPER_ADMIN', 'IT_ADMIN'));

// ─── Combined dashboard snapshot ─────────────────────────
router.get('/dashboard', getSREDashboard);

// ─── Individual metric endpoints ─────────────────────────
router.get('/health', getSystemHealth);
router.get('/database', getDatabaseMetrics);
router.get('/requests', getRequestMetrics);
router.get('/errors', getRecentErrors);
router.get('/runtime', getRuntimeInfo);

module.exports = router;
