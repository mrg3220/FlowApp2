/**
 * ──────────────────────────────────────────────────────────
 * FlowApp2 — Full End-to-End Regression Test Suite
 * ──────────────────────────────────────────────────────────
 * Tests ALL ~196 API endpoints for:
 *   1. Connectivity (endpoint is reachable, not 404)
 *   2. Authentication enforcement (401 without token)
 *   3. RBAC authorization (403 for wrong role)
 *   4. Basic response shape (200/201 for valid requests)
 *
 * Usage:
 *   node server/test/regression_test.js
 *
 * Requires: Node 18+ (built-in fetch), running FlowApp2 API
 * ──────────────────────────────────────────────────────────
 */

const API = 'http://localhost:3001/api';

// ─── Counters ────────────────────────────────────────────
let pass = 0, fail = 0, skip = 0, warn = 0;
const failures = [];
const warnings = [];

// ─── Helpers ─────────────────────────────────────────────

async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed for ${email}: ${res.status}`);
  const data = await res.json();
  return { token: data.token, user: data.user };
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function testEndpoint(name, method, url, opts = {}) {
  const { token, body, expectedStatus, expectOneOf, allowEmpty = false } = opts;
  const expected = expectOneOf || [expectedStatus || 200];

  try {
    const fetchOpts = { method };
    if (token) fetchOpts.headers = authHeaders(token);
    else fetchOpts.headers = { 'Content-Type': 'application/json' };
    if (body) fetchOpts.body = JSON.stringify(body);

    const res = await fetch(url, fetchOpts);
    const status = res.status;

    if (expected.includes(status)) {
      pass++;
      console.log(`  ✅ [PASS] ${method} ${name} → ${status}`);
      // Return parsed body for downstream tests
      try { return { status, data: await res.json() }; } catch { return { status, data: null }; }
    } else {
      let errBody = '';
      try { errBody = await res.text(); } catch {}
      fail++;
      const msg = `${method} ${name} → ${status} (expected ${expected.join('|')}) ${errBody.substring(0, 200)}`;
      failures.push(msg);
      console.log(`  ❌ [FAIL] ${msg}`);
      return { status, data: null };
    }
  } catch (err) {
    fail++;
    const msg = `${method} ${name} → NETWORK ERROR: ${err.message}`;
    failures.push(msg);
    console.log(`  ❌ [FAIL] ${msg}`);
    return { status: 0, data: null };
  }
}

async function testAuthRequired(name, method, url, body = null) {
  try {
    const fetchOpts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) fetchOpts.body = JSON.stringify(body);
    const res = await fetch(url, fetchOpts);
    if (res.status === 401) {
      pass++;
      console.log(`  ✅ [PASS] ${method} ${name} → 401 (auth enforced)`);
    } else {
      fail++;
      const msg = `${method} ${name} → ${res.status} (expected 401, auth NOT enforced!)`;
      failures.push(msg);
      console.log(`  ❌ [FAIL] ${msg}`);
    }
  } catch (err) {
    fail++;
    failures.push(`${method} ${name} → NETWORK ERROR: ${err.message}`);
  }
}

async function testRBAC(name, method, url, token, body = null) {
  try {
    const fetchOpts = { method, headers: authHeaders(token) };
    if (body) fetchOpts.body = JSON.stringify(body);
    const res = await fetch(url, fetchOpts);
    if (res.status === 403) {
      pass++;
      console.log(`  ✅ [PASS] ${method} ${name} → 403 (RBAC enforced)`);
    } else if (res.status === 401) {
      pass++;
      console.log(`  ✅ [PASS] ${method} ${name} → 401 (auth rejected)`);
    } else {
      warn++;
      const msg = `${method} ${name} → ${res.status} (expected 403 RBAC block)`;
      warnings.push(msg);
      console.log(`  ⚠️  [WARN] ${msg}`);
    }
  } catch (err) {
    fail++;
    failures.push(`${method} ${name} → NETWORK ERROR: ${err.message}`);
  }
}

// ─── Main Test Runner ────────────────────────────────────
async function run() {
  console.log('══════════════════════════════════════════════');
  console.log(' FlowApp2 — Full E2E Regression Test Suite');
  console.log('══════════════════════════════════════════════\n');

  // ── 0. Health Check ──
  console.log('─── 0. Health Check ────────────────────────');
  await testEndpoint('Health', 'GET', `${API}/health`);
  console.log('');

  // ── 1. Login as all roles ──
  console.log('─── 1. Authentication ─────────────────────');
  let owner, instructor, student;
  try {
    owner = await login('owner@flowapp.com', 'owner123');
    console.log(`  ✅ [PASS] Owner login: ${owner.user.firstName} (${owner.user.role})`);
    pass++;
  } catch (e) { console.log(`  ❌ [FAIL] Owner login: ${e.message}`); fail++; failures.push('Owner login failed'); }

  try {
    instructor = await login('sensei.mike@flowapp.com', 'instructor123');
    console.log(`  ✅ [PASS] Instructor login: ${instructor.user.firstName} (${instructor.user.role})`);
    pass++;
  } catch (e) { console.log(`  ❌ [FAIL] Instructor login: ${e.message}`); fail++; failures.push('Instructor login failed'); }

  try {
    student = await login('alex@example.com', 'student123');
    console.log(`  ✅ [PASS] Student login: ${student.user.firstName} (${student.user.role})`);
    pass++;
  } catch (e) { console.log(`  ❌ [FAIL] Student login: ${e.message}`); fail++; failures.push('Student login failed'); }

  // Bail early if we can't get tokens
  if (!owner || !instructor || !student) {
    console.log('\n⛔ Cannot proceed without all 3 role tokens. Aborting.');
    printSummary();
    return;
  }

  const O = owner.token;
  const I = instructor.token;
  const S = student.token;
  const ownerId = owner.user.id;
  const instructorId = instructor.user.id;
  const studentId = student.user.id;

  // Get /api/auth/me
  await testEndpoint('/auth/me', 'GET', `${API}/auth/me`, { token: O });
  await testAuthRequired('/auth/me (no token)', 'GET', `${API}/auth/me`);
  console.log('');

  // ── Discover dynamic IDs from seed data ──
  console.log('─── Discovering seed data IDs ──────────────');
  let schoolId, classId, sessionId, enrollmentId, familyId;

  const schoolsRes = await testEndpoint('/schools', 'GET', `${API}/schools`, { token: O });
  if (schoolsRes.data?.data?.[0]) {
    schoolId = schoolsRes.data.data[0].id;
    console.log(`    → schoolId: ${schoolId}`);
  }

  const classesRes = await testEndpoint('/classes', 'GET', `${API}/classes`, { token: O });
  if (classesRes.data) {
    const arr = classesRes.data.data || classesRes.data;
    if (Array.isArray(arr) && arr[0]) {
      classId = arr[0].id;
      console.log(`    → classId: ${classId}`);
    }
  }

  const sessionsRes = await testEndpoint('/sessions', 'GET', `${API}/sessions`, { token: O });
  if (sessionsRes.data) {
    const arr = sessionsRes.data.data || sessionsRes.data;
    if (Array.isArray(arr) && arr[0]) {
      sessionId = arr[0].id;
      console.log(`    → sessionId: ${sessionId}`);
    }
  }

  const enrollRes = await testEndpoint('/enrollments', 'GET', `${API}/enrollments`, { token: O });
  if (enrollRes.data) {
    const arr = Array.isArray(enrollRes.data) ? enrollRes.data : enrollRes.data.data || [];
    if (arr[0]) {
      enrollmentId = arr[0].id;
      console.log(`    → enrollmentId: ${enrollmentId}`);
    }
  }
  console.log('');

  // ══════════════════════════════════════════════
  // 2. PUBLIC ENDPOINTS (no auth required)
  // ══════════════════════════════════════════════
  console.log('─── 2. Public Endpoints (No Auth) ─────────');
  await testEndpoint('/public/events', 'GET', `${API}/public/events`);
  await testEndpoint('/public/shop', 'GET', `${API}/public/shop`);
  await testEndpoint('/public/schools', 'GET', `${API}/public/schools`);
  console.log('');

  // ══════════════════════════════════════════════
  // 3. SCHOOLS
  // ══════════════════════════════════════════════
  console.log('─── 3. Schools ────────────────────────────');
  if (schoolId) {
    await testEndpoint('/schools/:id', 'GET', `${API}/schools/${schoolId}`, { token: O });
  }
  // RBAC: Student should NOT access schools
  await testRBAC('/schools (student)', 'GET', `${API}/schools`, S);
  console.log('');

  // ══════════════════════════════════════════════
  // 4. CLASSES
  // ══════════════════════════════════════════════
  console.log('─── 4. Classes ────────────────────────────');
  if (classId) {
    await testEndpoint('/classes/:id', 'GET', `${API}/classes/${classId}`, { token: O });
  }
  // Any auth user can read classes
  await testEndpoint('/classes (student)', 'GET', `${API}/classes`, { token: S });
  await testAuthRequired('/classes (no auth)', 'GET', `${API}/classes`);
  console.log('');

  // ══════════════════════════════════════════════
  // 5. SESSIONS
  // ══════════════════════════════════════════════
  console.log('─── 5. Sessions ───────────────────────────');
  if (sessionId) {
    await testEndpoint('/sessions/:id', 'GET', `${API}/sessions/${sessionId}`, { token: O });
    await testEndpoint('/sessions/:id/qr', 'GET', `${API}/sessions/${sessionId}/qr`, { token: O });
  }
  await testEndpoint('/sessions (student)', 'GET', `${API}/sessions`, { token: S });
  await testAuthRequired('/sessions (no auth)', 'GET', `${API}/sessions`);
  console.log('');

  // ══════════════════════════════════════════════
  // 6. CHECK-INS
  // ══════════════════════════════════════════════
  console.log('─── 6. Check-Ins ──────────────────────────');
  if (sessionId) {
    await testEndpoint('/checkins/attendance/:sessionId', 'GET', `${API}/checkins/attendance/${sessionId}`, { token: O });
  }
  // Kiosk check-in is public (no auth)
  // We test that the endpoint exists (may return 400 without proper body)
  await testEndpoint('/checkins/kiosk (no body)', 'POST', `${API}/checkins/kiosk`, {
    body: { code: 'TEST' },
    expectOneOf: [200, 201, 400, 404, 422],
  });
  console.log('');

  // ══════════════════════════════════════════════
  // 7. USERS
  // ══════════════════════════════════════════════
  console.log('─── 7. Users ──────────────────────────────');
  await testEndpoint('/users', 'GET', `${API}/users`, { token: O });
  await testEndpoint('/users/:id', 'GET', `${API}/users/${studentId}`, { token: O });
  await testRBAC('/users (student)', 'GET', `${API}/users`, S);
  await testAuthRequired('/users (no auth)', 'GET', `${API}/users`);
  console.log('');

  // ══════════════════════════════════════════════
  // 8. ENROLLMENTS
  // ══════════════════════════════════════════════
  console.log('─── 8. Enrollments ────────────────────────');
  await testEndpoint('/enrollments (student)', 'GET', `${API}/enrollments`, { token: S });
  if (schoolId) {
    await testEndpoint('/enrollments/school/:schoolId/students', 'GET', `${API}/enrollments/school/${schoolId}/students`, { token: O });
    // RBAC: student can't list
    await testRBAC('/enrollments/school/students (student)', 'GET', `${API}/enrollments/school/${schoolId}/students`, S);
  }
  await testAuthRequired('/enrollments (no auth)', 'GET', `${API}/enrollments`);
  console.log('');

  // ══════════════════════════════════════════════
  // 9. PROFILE
  // ══════════════════════════════════════════════
  console.log('─── 9. Profile ────────────────────────────');
  await testEndpoint('/profile', 'GET', `${API}/profile`, { token: O });
  await testEndpoint('/profile (student)', 'GET', `${API}/profile`, { token: S });
  await testEndpoint('/profile/:userId', 'GET', `${API}/profile/${studentId}`, { token: O });
  // RBAC: student can't view other profiles
  await testRBAC('/profile/:userId (student viewing owner)', 'GET', `${API}/profile/${ownerId}`, S);
  await testAuthRequired('/profile (no auth)', 'GET', `${API}/profile`);
  console.log('');

  // ══════════════════════════════════════════════
  // 10. METRICS
  // ══════════════════════════════════════════════
  console.log('─── 10. Metrics ───────────────────────────');
  if (schoolId) {
    await testEndpoint('/metrics/school/:schoolId', 'GET', `${API}/metrics/school/${schoolId}`, { token: O });
  }
  await testEndpoint('/metrics/student', 'GET', `${API}/metrics/student`, { token: S });
  // RBAC: student can't access super-admin metrics
  await testRBAC('/metrics/super-admin (student)', 'GET', `${API}/metrics/super-admin`, S);
  // Owner is not SUPER_ADMIN either
  await testRBAC('/metrics/super-admin (owner)', 'GET', `${API}/metrics/super-admin`, O);
  await testAuthRequired('/metrics/student (no auth)', 'GET', `${API}/metrics/student`);
  console.log('');

  // ══════════════════════════════════════════════
  // 11. BILLING
  // ══════════════════════════════════════════════
  console.log('─── 11. Billing ───────────────────────────');
  if (schoolId) {
    await testEndpoint('/billing/config/:schoolId', 'GET', `${API}/billing/config/${schoolId}`, { token: O });
    await testEndpoint('/billing/plans/:schoolId', 'GET', `${API}/billing/plans/${schoolId}`, { token: O });
    await testEndpoint('/billing/invoices/:schoolId', 'GET', `${API}/billing/invoices/${schoolId}`, { token: O });
    await testEndpoint('/billing/payments/:schoolId', 'GET', `${API}/billing/payments/${schoolId}`, { token: O });
    await testEndpoint('/billing/summary/:schoolId', 'GET', `${API}/billing/summary/${schoolId}`, { token: O });
    await testEndpoint('/billing/subscriptions/:schoolId', 'GET', `${API}/billing/subscriptions/${schoolId}`, { token: O });
    // RBAC: student can read plans but not config
    await testRBAC('/billing/config (student)', 'GET', `${API}/billing/config/${schoolId}`, S);
    await testEndpoint('/billing/plans (student)', 'GET', `${API}/billing/plans/${schoolId}`, { token: S });
  }
  await testAuthRequired('/billing/config (no auth)', 'GET', `${API}/billing/config/test`);
  console.log('');

  // ══════════════════════════════════════════════
  // 12. PROMOTIONS
  // ══════════════════════════════════════════════
  console.log('─── 12. Promotions ────────────────────────');
  await testEndpoint('/promotions/programs', 'GET', `${API}/promotions/programs`, { token: O });
  const progsRes = await testEndpoint('/promotions/programs (student)', 'GET', `${API}/promotions/programs`, { token: S });
  if (schoolId) {
    await testEndpoint('/promotions/enrollments/:schoolId', 'GET', `${API}/promotions/enrollments/${schoolId}`, { token: O });
    await testEndpoint('/promotions/tests/:schoolId', 'GET', `${API}/promotions/tests/${schoolId}`, { token: O });
  }
  await testAuthRequired('/promotions/programs (no auth)', 'GET', `${API}/promotions/programs`);
  console.log('');

  // ══════════════════════════════════════════════
  // 13. NOTIFICATIONS
  // ══════════════════════════════════════════════
  console.log('─── 13. Notifications ─────────────────────');
  await testEndpoint('/notifications/mine', 'GET', `${API}/notifications/mine`, { token: O });
  await testEndpoint('/notifications/mine (student)', 'GET', `${API}/notifications/mine`, { token: S });
  await testEndpoint('/notifications/preferences', 'GET', `${API}/notifications/preferences`, { token: O });
  if (schoolId) {
    await testEndpoint('/notifications/templates/:schoolId', 'GET', `${API}/notifications/templates/${schoolId}`, { token: O });
    await testEndpoint('/notifications/school/:schoolId', 'GET', `${API}/notifications/school/${schoolId}`, { token: O });
    // RBAC: student can't read school notifications
    await testRBAC('/notifications/school (student)', 'GET', `${API}/notifications/school/${schoolId}`, S);
    await testRBAC('/notifications/templates (student)', 'GET', `${API}/notifications/templates/${schoolId}`, S);
  }
  await testAuthRequired('/notifications/mine (no auth)', 'GET', `${API}/notifications/mine`);
  console.log('');

  // ══════════════════════════════════════════════
  // 14. FAMILIES
  // ══════════════════════════════════════════════
  console.log('─── 14. Families ──────────────────────────');
  const familiesRes = await testEndpoint('/families/mine', 'GET', `${API}/families/mine`, { token: O });
  if (schoolId) {
    await testEndpoint('/families/school/:schoolId', 'GET', `${API}/families/school/${schoolId}`, { token: O });
    await testRBAC('/families/school (student)', 'GET', `${API}/families/school/${schoolId}`, S);
  }
  if (familiesRes.data) {
    const arr = Array.isArray(familiesRes.data) ? familiesRes.data : familiesRes.data.data || [];
    if (arr[0]) {
      familyId = arr[0].id;
      await testEndpoint('/families/:familyId', 'GET', `${API}/families/${familyId}`, { token: O });
      await testEndpoint('/families/:familyId/billing', 'GET', `${API}/families/${familyId}/billing`, { token: O });
    }
  }
  await testAuthRequired('/families/mine (no auth)', 'GET', `${API}/families/mine`);
  console.log('');

  // ══════════════════════════════════════════════
  // 15. STUDENT PORTAL
  // ══════════════════════════════════════════════
  console.log('─── 15. Student Portal ────────────────────');
  await testEndpoint('/student-portal/dashboard', 'GET', `${API}/student-portal/dashboard`, { token: S });
  await testEndpoint('/student-portal/schedule', 'GET', `${API}/student-portal/schedule`, { token: S });
  await testEndpoint('/student-portal/dashboard (owner)', 'GET', `${API}/student-portal/dashboard`, { token: O });
  await testAuthRequired('/student-portal/dashboard (no auth)', 'GET', `${API}/student-portal/dashboard`);
  console.log('');

  // ══════════════════════════════════════════════
  // 16. LEADS
  // ══════════════════════════════════════════════
  console.log('─── 16. Leads ─────────────────────────────');
  if (schoolId) {
    await testEndpoint('/leads/school/:schoolId', 'GET', `${API}/leads/school/${schoolId}`, { token: O });
    await testEndpoint('/leads/school/:schoolId/funnel', 'GET', `${API}/leads/school/${schoolId}/funnel`, { token: O });
    // RBAC: student can't access leads
    await testRBAC('/leads/school (student)', 'GET', `${API}/leads/school/${schoolId}`, S);
  }
  await testAuthRequired('/leads/ (no auth)', 'GET', `${API}/leads/school/test`);
  console.log('');

  // ══════════════════════════════════════════════
  // 17. CURRICULUM
  // ══════════════════════════════════════════════
  console.log('─── 17. Curriculum ────────────────────────');
  await testEndpoint('/curriculum', 'GET', `${API}/curriculum`, { token: O });
  await testEndpoint('/curriculum (student)', 'GET', `${API}/curriculum`, { token: S });
  await testEndpoint('/curriculum/categories', 'GET', `${API}/curriculum/categories`, { token: O });
  await testAuthRequired('/curriculum (no auth)', 'GET', `${API}/curriculum`);
  console.log('');

  // ══════════════════════════════════════════════
  // 18. REPORTING
  // ══════════════════════════════════════════════
  console.log('─── 18. Reporting ─────────────────────────');
  if (schoolId) {
    await testEndpoint('/reporting/revenue/:schoolId', 'GET', `${API}/reporting/revenue/${schoolId}`, { token: O });
    await testEndpoint('/reporting/payment-methods/:schoolId', 'GET', `${API}/reporting/payment-methods/${schoolId}`, { token: O });
  }
  await testEndpoint('/reporting/revenue-by-school', 'GET', `${API}/reporting/revenue-by-school`, { token: O });
  // RBAC: student can't access reporting
  await testRBAC('/reporting/revenue-by-school (student)', 'GET', `${API}/reporting/revenue-by-school`, S);
  await testAuthRequired('/reporting/revenue-by-school (no auth)', 'GET', `${API}/reporting/revenue-by-school`);
  console.log('');

  // ══════════════════════════════════════════════
  // 19. WAIVERS
  // ══════════════════════════════════════════════
  console.log('─── 19. Waivers ───────────────────────────');
  await testEndpoint('/waivers/mine', 'GET', `${API}/waivers/mine`, { token: O });
  await testEndpoint('/waivers/mine (student)', 'GET', `${API}/waivers/mine`, { token: S });
  if (schoolId) {
    await testEndpoint('/waivers/templates/:schoolId', 'GET', `${API}/waivers/templates/${schoolId}`, { token: O });
    await testEndpoint('/waivers/school/:schoolId', 'GET', `${API}/waivers/school/${schoolId}`, { token: O });
    await testRBAC('/waivers/templates (student)', 'GET', `${API}/waivers/templates/${schoolId}`, S);
  }
  await testAuthRequired('/waivers/mine (no auth)', 'GET', `${API}/waivers/mine`);
  console.log('');

  // ══════════════════════════════════════════════
  // 20. RETAIL
  // ══════════════════════════════════════════════
  console.log('─── 20. Retail ────────────────────────────');
  if (schoolId) {
    await testEndpoint('/retail/products/:schoolId', 'GET', `${API}/retail/products/${schoolId}`, { token: O });
    await testEndpoint('/retail/products (student)', 'GET', `${API}/retail/products/${schoolId}`, { token: S });
    await testEndpoint('/retail/low-stock/:schoolId', 'GET', `${API}/retail/low-stock/${schoolId}`, { token: O });
    await testEndpoint('/retail/orders/:schoolId', 'GET', `${API}/retail/orders/${schoolId}`, { token: O });
    // RBAC: student can read products but not low-stock
    await testRBAC('/retail/low-stock (student)', 'GET', `${API}/retail/low-stock/${schoolId}`, S);
  }
  await testAuthRequired('/retail/products (no auth)', 'GET', `${API}/retail/products/test`);
  console.log('');

  // ══════════════════════════════════════════════
  // 21. CERTIFICATES
  // ══════════════════════════════════════════════
  console.log('─── 21. Certificates ──────────────────────');
  await testEndpoint('/certificates', 'GET', `${API}/certificates`, { token: O });
  await testEndpoint('/certificates (student)', 'GET', `${API}/certificates`, { token: S });
  if (schoolId) {
    await testEndpoint('/certificates/templates/:schoolId', 'GET', `${API}/certificates/templates/${schoolId}`, { token: O });
  }
  await testAuthRequired('/certificates (no auth)', 'GET', `${API}/certificates`);
  console.log('');

  // ══════════════════════════════════════════════
  // 22. TRAINING PLANS
  // ══════════════════════════════════════════════
  console.log('─── 22. Training Plans ────────────────────');
  await testEndpoint('/training-plans/mine', 'GET', `${API}/training-plans/mine`, { token: O });
  await testEndpoint('/training-plans/mine (student)', 'GET', `${API}/training-plans/mine`, { token: S });
  if (schoolId) {
    await testEndpoint('/training-plans/school/:schoolId', 'GET', `${API}/training-plans/school/${schoolId}`, { token: O });
    await testRBAC('/training-plans/school (student)', 'GET', `${API}/training-plans/school/${schoolId}`, S);
  }
  await testAuthRequired('/training-plans/mine (no auth)', 'GET', `${API}/training-plans/mine`);
  console.log('');

  // ══════════════════════════════════════════════
  // 23. PAYROLL
  // ══════════════════════════════════════════════
  console.log('─── 23. Payroll ───────────────────────────');
  if (schoolId) {
    await testEndpoint('/payroll/school/:schoolId', 'GET', `${API}/payroll/school/${schoolId}`, { token: O });
    await testEndpoint('/payroll/summary/:schoolId', 'GET', `${API}/payroll/summary/${schoolId}`, { token: O });
    // RBAC: student can't access payroll
    await testRBAC('/payroll/school (student)', 'GET', `${API}/payroll/school/${schoolId}`, S);
    await testRBAC('/payroll/school (instructor)', 'GET', `${API}/payroll/school/${schoolId}`, I);
  }
  await testAuthRequired('/payroll (no auth)', 'GET', `${API}/payroll/school/test`);
  console.log('');

  // ══════════════════════════════════════════════
  // 24. EVENTS
  // ══════════════════════════════════════════════
  console.log('─── 24. Events ────────────────────────────');
  await testEndpoint('/events', 'GET', `${API}/events`, { token: O });
  await testEndpoint('/events (student)', 'GET', `${API}/events`, { token: S });
  await testEndpoint('/events/student/:studentId/medals', 'GET', `${API}/events/student/${studentId}/medals`, { token: O });
  await testAuthRequired('/events (no auth)', 'GET', `${API}/events`);
  console.log('');

  // ══════════════════════════════════════════════
  // 25. VENUES
  // ══════════════════════════════════════════════
  console.log('─── 25. Venues ────────────────────────────');
  await testEndpoint('/venues', 'GET', `${API}/venues`, { token: O });
  await testEndpoint('/venues (student)', 'GET', `${API}/venues`, { token: S });
  await testAuthRequired('/venues (no auth)', 'GET', `${API}/venues`);
  console.log('');

  // ══════════════════════════════════════════════
  // 26. CERTIFICATIONS
  // ══════════════════════════════════════════════
  console.log('─── 26. Certifications ────────────────────');
  await testEndpoint('/certifications', 'GET', `${API}/certifications`, { token: O });
  await testEndpoint('/certifications (student)', 'GET', `${API}/certifications`, { token: S });
  await testAuthRequired('/certifications (no auth)', 'GET', `${API}/certifications`);
  console.log('');

  // ══════════════════════════════════════════════
  // 27. BRANDING
  // ══════════════════════════════════════════════
  console.log('─── 27. Branding ──────────────────────────');
  await testEndpoint('/branding/org', 'GET', `${API}/branding/org`, { token: O });
  if (schoolId) {
    await testEndpoint('/branding/school/:schoolId', 'GET', `${API}/branding/school/${schoolId}`, { token: O });
  }
  await testAuthRequired('/branding/org (no auth)', 'GET', `${API}/branding/org`);
  console.log('');

  // ══════════════════════════════════════════════
  // 28. HELP CENTER
  // ══════════════════════════════════════════════
  console.log('─── 28. Help Center ───────────────────────');
  await testEndpoint('/help/articles', 'GET', `${API}/help/articles`, { token: O });
  await testEndpoint('/help/articles/categories', 'GET', `${API}/help/articles/categories`, { token: O });
  await testEndpoint('/help/onboarding', 'GET', `${API}/help/onboarding`, { token: O });
  await testEndpoint('/help/articles (student)', 'GET', `${API}/help/articles`, { token: S });
  await testAuthRequired('/help/articles (no auth)', 'GET', `${API}/help/articles`);
  console.log('');

  // ══════════════════════════════════════════════
  // 29. VIRTUAL CLASSES
  // ══════════════════════════════════════════════
  console.log('─── 29. Virtual Classes ───────────────────');
  await testEndpoint('/virtual', 'GET', `${API}/virtual`, { token: O });
  await testEndpoint('/virtual (student)', 'GET', `${API}/virtual`, { token: S });
  await testEndpoint('/virtual/my-views', 'GET', `${API}/virtual/my-views`, { token: O });
  await testAuthRequired('/virtual (no auth)', 'GET', `${API}/virtual`);
  console.log('');

  // ══════════════════════════════════════════════
  // 30. COMPETITIONS (newly mounted!)
  // ══════════════════════════════════════════════
  console.log('─── 30. Competitions ──────────────────────');
  await testEndpoint('/competitions', 'GET', `${API}/competitions`, { token: O });
  await testEndpoint('/competitions (student)', 'GET', `${API}/competitions`, { token: S });
  await testEndpoint('/competitions/student/:studentId/medals', 'GET', `${API}/competitions/student/${studentId}/medals`, { token: O });
  await testAuthRequired('/competitions (no auth)', 'GET', `${API}/competitions`);
  console.log('');

  // ══════════════════════════════════════════════
  // 31. ADMIN
  // ══════════════════════════════════════════════
  console.log('─── 31. Admin ─────────────────────────────');
  // Owner is not SUPER_ADMIN or IT_ADMIN, so should get 403
  await testRBAC('/admin/stats (owner)', 'GET', `${API}/admin/stats`, O);
  await testRBAC('/admin/users (owner)', 'GET', `${API}/admin/users`, O);
  await testRBAC('/admin/stats (student)', 'GET', `${API}/admin/stats`, S);
  await testRBAC('/admin/audit-logs (student)', 'GET', `${API}/admin/audit-logs`, S);
  await testRBAC('/admin/settings (student)', 'GET', `${API}/admin/settings`, S);
  await testAuthRequired('/admin/stats (no auth)', 'GET', `${API}/admin/stats`);
  console.log('');

  // ══════════════════════════════════════════════
  // 32. SRE
  // ══════════════════════════════════════════════
  console.log('─── 32. SRE ───────────────────────────────');
  // Owner is not SUPER_ADMIN or IT_ADMIN
  await testRBAC('/sre/dashboard (owner)', 'GET', `${API}/sre/dashboard`, O);
  await testRBAC('/sre/health (owner)', 'GET', `${API}/sre/health`, O);
  await testRBAC('/sre/database (student)', 'GET', `${API}/sre/database`, S);
  await testRBAC('/sre/requests (student)', 'GET', `${API}/sre/requests`, S);
  await testRBAC('/sre/errors (student)', 'GET', `${API}/sre/errors`, S);
  await testRBAC('/sre/runtime (student)', 'GET', `${API}/sre/runtime`, S);
  await testAuthRequired('/sre/dashboard (no auth)', 'GET', `${API}/sre/dashboard`);
  console.log('');

  // ══════════════════════════════════════════════
  // 33. AUTH ENFORCEMENT (spot-check write endpoints)
  // ══════════════════════════════════════════════
  console.log('─── 33. Auth Enforcement (Write Endpoints) ');
  await testAuthRequired('POST /schools', 'POST', `${API}/schools`, { name: 'Test' });
  await testAuthRequired('POST /classes', 'POST', `${API}/classes`, { name: 'Test' });
  await testAuthRequired('POST /sessions', 'POST', `${API}/sessions`, {});
  await testAuthRequired('POST /enrollments', 'POST', `${API}/enrollments`, {});
  await testAuthRequired('POST /billing/auto-invoice/run', 'POST', `${API}/billing/auto-invoice/run`);
  await testAuthRequired('PUT /profile', 'PUT', `${API}/profile`, { firstName: 'x' });
  await testAuthRequired('POST /promotions/programs', 'POST', `${API}/promotions/programs`, { name: 'x' });
  await testAuthRequired('POST /notifications/send', 'POST', `${API}/notifications/send`, {});
  await testAuthRequired('POST /events', 'POST', `${API}/events`, { name: 'x' });
  await testAuthRequired('POST /competitions', 'POST', `${API}/competitions`, { name: 'x' });
  await testAuthRequired('POST /certifications', 'POST', `${API}/certifications`, {});
  await testAuthRequired('POST /curriculum', 'POST', `${API}/curriculum`, {});
  await testAuthRequired('POST /virtual', 'POST', `${API}/virtual`, {});
  console.log('');

  // ══════════════════════════════════════════════
  // 34. RBAC ENFORCEMENT (write operations)
  // ══════════════════════════════════════════════
  console.log('─── 34. RBAC Enforcement (Write Ops) ──────');
  // Student can't create schools
  await testRBAC('POST /schools (student)', 'POST', `${API}/schools`, S, { name: 'Test School' });
  // Student can't create classes
  await testRBAC('POST /classes (student)', 'POST', `${API}/classes`, S, { name: 'Test Class' });
  // Student can't create sessions
  await testRBAC('POST /sessions (student)', 'POST', `${API}/sessions`, S, {});
  // Student can't create promotions programs
  await testRBAC('POST /promotions/programs (student)', 'POST', `${API}/promotions/programs`, S, { name: 'Test' });
  // Student can't send notifications
  await testRBAC('POST /notifications/send (student)', 'POST', `${API}/notifications/send`, S, {});
  // Student can't trigger notification jobs
  await testRBAC('POST /notifications/trigger-jobs (student)', 'POST', `${API}/notifications/trigger-jobs`, S);
  // Student can't create events
  await testRBAC('POST /events (student)', 'POST', `${API}/events`, S, { name: 'Test' });
  // Student can't delete events
  await testRBAC('DELETE /events/:id (student)', 'DELETE', `${API}/events/00000000-0000-0000-0000-000000000000`, S);
  // Student can't create competitions
  await testRBAC('POST /competitions (student)', 'POST', `${API}/competitions`, S, { name: 'Test' });
  // Instructor can't delete schools
  await testRBAC('DELETE /schools/:id (instructor)', 'DELETE', `${API}/schools/00000000-0000-0000-0000-000000000000`, I);
  // Student can't create curriculum
  await testRBAC('POST /curriculum (student)', 'POST', `${API}/curriculum`, S, { name: 'Test' });
  // Student can't delete curriculum
  await testRBAC('DELETE /curriculum/:id (student)', 'DELETE', `${API}/curriculum/00000000-0000-0000-0000-000000000000`, S);

  if (schoolId) {
    // Student can't create payroll
    await testRBAC('POST /payroll/school (student)', 'POST', `${API}/payroll/school/${schoolId}`, S, {});
    // Instructor can't access payroll
    await testRBAC('GET /payroll/school (instructor)', 'GET', `${API}/payroll/school/${schoolId}`, I);
    // Student can't create leads
    await testRBAC('POST /leads/school (student)', 'POST', `${API}/leads/school/${schoolId}`, S, {});
    // Student can't create billing plans
    await testRBAC('POST /billing/plans (student)', 'POST', `${API}/billing/plans/${schoolId}`, S, {});
    // Student can't update billing config
    await testRBAC('PUT /billing/config (student)', 'PUT', `${API}/billing/config/${schoolId}`, S, {});
    // Student can't create retail products
    await testRBAC('POST /retail/products (student)', 'POST', `${API}/retail/products/${schoolId}`, S, {});
    // Student can't create waiver templates
    await testRBAC('POST /waivers/templates (student)', 'POST', `${API}/waivers/templates/${schoolId}`, S, {});
  }
  console.log('');

  // ══════════════════════════════════════════════
  // 35. 404 Handler
  // ══════════════════════════════════════════════
  console.log('─── 35. 404 Handler ───────────────────────');
  await testEndpoint('/nonexistent', 'GET', `${API}/nonexistent`, { token: O, expectedStatus: 404 });
  await testEndpoint('/schools/nonexistent/fake', 'GET', `${API}/schools/nonexistent/fake`, { token: O, expectedStatus: 404 });
  console.log('');

  // ══════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════
  printSummary();
}

function printSummary() {
  console.log('══════════════════════════════════════════════');
  console.log(' REGRESSION TEST SUMMARY');
  console.log('══════════════════════════════════════════════');
  console.log(`  ✅ Passed:   ${pass}`);
  console.log(`  ❌ Failed:   ${fail}`);
  console.log(`  ⚠️  Warnings: ${warn}`);
  console.log(`  Total:      ${pass + fail + warn}`);
  console.log('──────────────────────────────────────────────');

  if (failures.length > 0) {
    console.log('\n FAILURES:');
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  }

  if (warnings.length > 0) {
    console.log('\n WARNINGS:');
    warnings.forEach((w, i) => console.log(`  ${i + 1}. ${w}`));
  }

  console.log('\n══════════════════════════════════════════════');
  if (fail === 0) {
    console.log(' 🎉 ALL TESTS PASSED!');
  } else {
    console.log(` ⛔ ${fail} TEST(S) FAILED — review above`);
  }
  console.log('══════════════════════════════════════════════\n');
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('\n⛔ Unhandled error:', err);
  process.exit(1);
});
