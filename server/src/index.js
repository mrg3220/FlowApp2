/**
 * ──────────────────────────────────────────────────────────
 * FlowApp2 — Express API Server Entry Point
 * ──────────────────────────────────────────────────────────
 * Initialises middleware, routes, security controls, and
 * scheduled services. See inline security comments for the
 * threat model behind each middleware choice.
 * ──────────────────────────────────────────────────────────
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');

// ─── Route imports ───────────────────────────────────────
const authRoutes = require('./routes/auth');
const classRoutes = require('./routes/classes');
const sessionRoutes = require('./routes/sessions');
const checkInRoutes = require('./routes/checkins');
const userRoutes = require('./routes/users');
const schoolRoutes = require('./routes/schools');
const enrollmentRoutes = require('./routes/enrollments');
const profileRoutes = require('./routes/profile');
const metricsRoutes = require('./routes/metrics');
const billingRoutes = require('./routes/billing');
const promotionRoutes = require('./routes/promotions');
const notificationRoutes = require('./routes/notifications');
const familyRoutes = require('./routes/families');
const studentPortalRoutes = require('./routes/studentPortal');
const leadRoutes = require('./routes/leads');
const curriculumRoutes = require('./routes/curriculum');
const reportingRoutes = require('./routes/reporting');
const waiverRoutes = require('./routes/waivers');
const retailRoutes = require('./routes/retail');
const certificateRoutes = require('./routes/certificates');
const trainingPlanRoutes = require('./routes/trainingPlans');
const payrollRoutes = require('./routes/payroll');
const eventRoutes = require('./routes/events');
const venueRoutes = require('./routes/venues');
const certificationRoutes = require('./routes/certifications');
const brandingRoutes = require('./routes/branding');
const helpRoutes = require('./routes/help');
const publicRoutes = require('./routes/public');
const virtualRoutes = require('./routes/virtual');
const adminRoutes = require('./routes/admin');
const sreRoutes = require('./routes/sre');
const { requestMetricsMiddleware } = require('./middleware/requestMetrics');

const app = express();

// ──────────────────────────────────────────────────────────
// Security Middleware
// ──────────────────────────────────────────────────────────

/**
 * Helmet — sets secure HTTP response headers.
 * Mitigates: clickjacking, MIME sniffing, XSS, information leakage.
 * This is a baseline defence layer; Nginx adds additional headers.
 */
app.use(helmet());

/**
 * CORS — restrict cross-origin requests to known origins.
 * Mitigates: unauthorized third-party API access.
 * In production, CORS_ORIGIN should be set to the exact frontend URL.
 */
const corsOptions = {
  origin: config.corsOrigin === '*'
    ? '*'
    : config.corsOrigin.split(',').map((o) => o.trim()),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,  // Pre-flight cache: 10 minutes
};
app.use(cors(corsOptions));

/**
 * Body parser with size limit.
 * Mitigates: denial-of-service via oversized JSON payloads.
 * 1MB is generous for a JSON API; adjust if file uploads are added.
 */
app.use(express.json({ limit: '1mb' }));

/**
 * Request metrics collector — tracks throughput, latency,
 * error rates per endpoint for the SRE dashboard.
 */
app.use(requestMetricsMiddleware);

/**
 * Global rate limiter — prevents abuse across all endpoints.
 * Mitigates: brute-force attacks, scraping, denial of service.
 * 200 requests per 15-minute window per IP.
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 200,                    // requests per window per IP
  standardHeaders: true,       // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,        // Disable X-RateLimit-* headers
  message: { error: 'Too many requests. Please try again later.' },
});
app.use(globalLimiter);

/**
 * Strict rate limiter for authentication endpoints.
 * Mitigates: credential stuffing, brute-force login attacks.
 * 15 attempts per 15-minute window per IP.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Too many authentication attempts. Please wait 15 minutes.' },
});

// ─── Health check (no auth, lightweight) ─────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ──────────────────────────────────────────────────────────
// Route Registration
// ──────────────────────────────────────────────────────────

// Auth routes get the strict rate limiter to prevent brute-force
app.use('/api/auth', authLimiter, authRoutes);

// Standard authenticated API routes
app.use('/api/schools', schoolRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/checkins', checkInRoutes);
app.use('/api/users', userRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/families', familyRoutes);
app.use('/api/student-portal', studentPortalRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/curriculum', curriculumRoutes);
app.use('/api/reporting', reportingRoutes);
app.use('/api/waivers', waiverRoutes);
app.use('/api/retail', retailRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/training-plans', trainingPlanRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/certifications', certificationRoutes);
app.use('/api/branding', brandingRoutes);
app.use('/api/help', helpRoutes);
app.use('/api/virtual', virtualRoutes);

// IT Admin & SRE routes — restricted to SUPER_ADMIN and IT_ADMIN
app.use('/api/admin', adminRoutes);
app.use('/api/sre', sreRoutes);

// Public routes — no auth required, but still rate-limited globally
app.use('/api/public', publicRoutes);

// ─── 404 handler ─────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global error handler (must be last) ─────────────────
app.use(errorHandler);

// ──────────────────────────────────────────────────────────
// Start Server & Scheduled Services
// ──────────────────────────────────────────────────────────
const { startScheduler } = require('./services/autoInvoice');
const { startNotificationScheduler } = require('./services/notificationService');

app.listen(config.port, () => {
  console.log(`🥋 FlowApp API running on http://localhost:${config.port}`);
  console.log(`   Environment: ${config.nodeEnv}`);
  console.log(`   CORS origin: ${config.corsOrigin}`);
  startScheduler();
  startNotificationScheduler();
});

module.exports = app;
