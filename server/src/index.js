require('dotenv').config();

const express = require('express');
const cors = require('cors');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');

// Route imports
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
const competitionRoutes = require('./routes/competitions');
const virtualRoutes = require('./routes/virtual');

const app = express();

// ─── Middleware ───────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Health check ────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Routes ──────────────────────────────────────────────
app.use('/api/auth', authRoutes);
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
app.use('/api/competitions', competitionRoutes);
app.use('/api/virtual', virtualRoutes);

// ─── 404 handler ─────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Error handler ───────────────────────────────────────
app.use(errorHandler);

// ─── Start server ────────────────────────────────────────
const { startScheduler } = require('./services/autoInvoice');
const { startNotificationScheduler } = require('./services/notificationService');
app.listen(config.port, () => {
  console.log(`🥋 FlowApp API running on http://localhost:${config.port}`);
  console.log(`   Environment: ${config.nodeEnv}`);
  startScheduler();
  startNotificationScheduler();
});

module.exports = app;
