const API_BASE = '/api';

/**
 * Generic fetch wrapper with auth token handling.
 */
async function request(endpoint, options = {}) {
  const token = localStorage.getItem('flowapp_token');

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, config);

  if (response.status === 401) {
    localStorage.removeItem('flowapp_token');
    localStorage.removeItem('flowapp_user');
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

// ─── Auth ────────────────────────────────────────────────

export const authApi = {
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  register: (data) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  getMe: () => request('/auth/me'),
};

// ─── Schools ─────────────────────────────────────────────

export const schoolApi = {
  getAll: () => request('/schools'),

  getById: (id) => request(`/schools/${id}`),

  create: (data) =>
    request('/schools', { method: 'POST', body: JSON.stringify(data) }),

  update: (id, data) =>
    request(`/schools/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id) =>
    request(`/schools/${id}`, { method: 'DELETE' }),
};

// ─── Enrollments ─────────────────────────────────────────

export const enrollmentApi = {
  getAll: (params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/enrollments${query}`);
  },

  getSchoolStudents: (schoolId) => request(`/enrollments/school/${schoolId}/students`),

  enroll: (studentId, schoolId) =>
    request('/enrollments', { method: 'POST', body: JSON.stringify({ studentId, schoolId }) }),

  transfer: (studentId, toSchoolId) =>
    request('/enrollments/transfer', { method: 'POST', body: JSON.stringify({ studentId, toSchoolId }) }),

  deactivate: (id) =>
    request(`/enrollments/${id}/deactivate`, { method: 'PUT' }),
};

// ─── Classes ─────────────────────────────────────────────

export const classApi = {
  getAll: (params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/classes${query}`);
  },

  getById: (id) => request(`/classes/${id}`),

  create: (data) =>
    request('/classes', { method: 'POST', body: JSON.stringify(data) }),

  update: (id, data) =>
    request(`/classes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id) =>
    request(`/classes/${id}`, { method: 'DELETE' }),
};

// ─── Sessions ────────────────────────────────────────────

export const sessionApi = {
  getAll: (params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/sessions${query}`);
  },

  getById: (id) => request(`/sessions/${id}`),

  create: (data) =>
    request('/sessions', { method: 'POST', body: JSON.stringify(data) }),

  updateStatus: (id, status) =>
    request(`/sessions/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  getQr: (id) => request(`/sessions/${id}/qr`),
};

// ─── Check-ins ───────────────────────────────────────────

export const checkInApi = {
  checkIn: (sessionId, studentId) =>
    request('/checkins', {
      method: 'POST',
      body: JSON.stringify({ sessionId, studentId, method: 'ADMIN' }),
    }),

  checkInByQr: (qrCode) =>
    request('/checkins/qr', { method: 'POST', body: JSON.stringify({ qrCode }) }),

  checkInByKiosk: (sessionId, email) =>
    request('/checkins/kiosk', { method: 'POST', body: JSON.stringify({ sessionId, email }) }),

  remove: (id) => request(`/checkins/${id}`, { method: 'DELETE' }),

  getAttendance: (sessionId) => request(`/checkins/attendance/${sessionId}`),
};

// ─── Users ───────────────────────────────────────────────

export const userApi = {
  getAll: (params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/users${query}`);
  },

  getById: (id) => request(`/users/${id}`),

  update: (id, data) =>
    request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// ─── Profile ─────────────────────────────────────────────

export const profileApi = {
  get: () => request('/profile'),

  update: (data) =>
    request('/profile', { method: 'PUT', body: JSON.stringify(data) }),

  getUser: (userId) => request(`/profile/${userId}`),
};

// ─── Metrics ─────────────────────────────────────────────

export const metricsApi = {
  getSuperAdmin: () => request('/metrics/super-admin'),

  getSchool: (schoolId) => request(`/metrics/school/${schoolId}`),

  getStudent: () => request('/metrics/student'),
};

// ─── Billing ─────────────────────────────────────────────

export const billingApi = {
  // Payment config (per-school)
  getConfig: (schoolId) => request(`/billing/config/${schoolId}`),
  updateConfig: (schoolId, data) =>
    request(`/billing/config/${schoolId}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Membership plans
  getPlans: (schoolId, params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/billing/plans/${schoolId}${query}`);
  },
  createPlan: (schoolId, data) =>
    request(`/billing/plans/${schoolId}`, { method: 'POST', body: JSON.stringify(data) }),
  updatePlan: (schoolId, planId, data) =>
    request(`/billing/plans/${schoolId}/${planId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePlan: (schoolId, planId) =>
    request(`/billing/plans/${schoolId}/${planId}`, { method: 'DELETE' }),

  // Invoices
  getInvoices: (schoolId, params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/billing/invoices/${schoolId}${query}`);
  },
  createInvoice: (schoolId, data) =>
    request(`/billing/invoices/${schoolId}`, { method: 'POST', body: JSON.stringify(data) }),
  updateInvoiceStatus: (schoolId, invoiceId, status) =>
    request(`/billing/invoices/${schoolId}/${invoiceId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // Payments
  getPayments: (schoolId, params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/billing/payments/${schoolId}${query}`);
  },
  recordPayment: (schoolId, data) =>
    request(`/billing/payments/${schoolId}`, { method: 'POST', body: JSON.stringify(data) }),

  // Summary
  getSummary: (schoolId) => request(`/billing/summary/${schoolId}`),

  // Subscriptions
  getSubscriptions: (schoolId, params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/billing/subscriptions/${schoolId}${query}`);
  },
  createSubscription: (schoolId, data) =>
    request(`/billing/subscriptions/${schoolId}`, { method: 'POST', body: JSON.stringify(data) }),
  updateSubscription: (schoolId, subscriptionId, data) =>
    request(`/billing/subscriptions/${schoolId}/${subscriptionId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  cancelSubscription: (schoolId, subscriptionId) =>
    request(`/billing/subscriptions/${schoolId}/${subscriptionId}`, { method: 'DELETE' }),

  // Auto-invoice manual trigger
  runAutoInvoice: () =>
    request('/billing/auto-invoice/run', { method: 'POST' }),
};

// ─── Promotions / Belt System ────────────────────────────

export const promotionApi = {
  // Programs
  getPrograms: (params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/promotions/programs${query}`);
  },
  getProgram: (programId) => request(`/promotions/programs/${programId}`),
  createProgram: (data) =>
    request('/promotions/programs', { method: 'POST', body: JSON.stringify(data) }),
  updateProgram: (programId, data) =>
    request(`/promotions/programs/${programId}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Belts
  createBelt: (programId, data) =>
    request(`/promotions/programs/${programId}/belts`, { method: 'POST', body: JSON.stringify(data) }),
  updateBelt: (beltId, data) =>
    request(`/promotions/belts/${beltId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBelt: (beltId) =>
    request(`/promotions/belts/${beltId}`, { method: 'DELETE' }),

  // Belt Requirements
  createRequirement: (beltId, data) =>
    request(`/promotions/belts/${beltId}/requirements`, { method: 'POST', body: JSON.stringify(data) }),
  updateRequirement: (requirementId, data) =>
    request(`/promotions/requirements/${requirementId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRequirement: (requirementId) =>
    request(`/promotions/requirements/${requirementId}`, { method: 'DELETE' }),

  // Program Enrollments
  getEnrollments: (schoolId, params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/promotions/enrollments/${schoolId}${query}`);
  },
  createEnrollment: (schoolId, data) =>
    request(`/promotions/enrollments/${schoolId}`, { method: 'POST', body: JSON.stringify(data) }),

  // Progress
  getProgress: (enrollmentId) => request(`/promotions/progress/${enrollmentId}`),
  updateProgress: (enrollmentId, data) =>
    request(`/promotions/progress/${enrollmentId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Promotions
  promoteStudent: (enrollmentId, data) =>
    request(`/promotions/promote/${enrollmentId}`, { method: 'POST', body: JSON.stringify(data) }),

  // Belt Tests
  getTests: (schoolId, params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/promotions/tests/${schoolId}${query}`);
  },
  createTest: (data) =>
    request('/promotions/tests', { method: 'POST', body: JSON.stringify(data) }),
  updateTest: (testId, data) =>
    request(`/promotions/tests/${testId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Essays
  submitEssay: (data) =>
    request('/promotions/essays', { method: 'POST', body: JSON.stringify(data) }),
  getEssays: (enrollmentId) => request(`/promotions/essays/${enrollmentId}`),
  reviewEssay: (essayId, data) =>
    request(`/promotions/essays/${essayId}/review`, { method: 'PATCH', body: JSON.stringify(data) }),
};

// ─── Notifications ───────────────────────────────────────

export const notificationApi = {
  // User inbox
  getMine: (params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/notifications/mine${query}`);
  },
  markRead: (ids) =>
    request('/notifications/read', { method: 'PUT', body: JSON.stringify({ ids }) }),

  // Preferences
  getPreferences: () => request('/notifications/preferences'),
  updatePreference: (type, channel, enabled) =>
    request('/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify({ type, channel, enabled }),
    }),

  // Templates (staff)
  getTemplates: (schoolId) => request(`/notifications/templates/${schoolId}`),
  upsertTemplate: (schoolId, data) =>
    request(`/notifications/templates/${schoolId}`, { method: 'PUT', body: JSON.stringify(data) }),

  // School log (staff)
  getSchoolLog: (schoolId, params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/notifications/school/${schoolId}${query}`);
  },

  // Send (staff)
  send: (data) =>
    request('/notifications/send', { method: 'POST', body: JSON.stringify(data) }),

  // Trigger jobs (super admin)
  triggerJobs: (job) =>
    request('/notifications/trigger-jobs', { method: 'POST', body: JSON.stringify({ job }) }),
};

// ─── Families / Households ───────────────────────────────

export const familyApi = {
  // My families (any user)
  getMine: () => request('/families/mine'),

  // School families (staff)
  getBySchool: (schoolId, params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/families/school/${schoolId}${query}`);
  },

  // Single family
  getById: (familyId) => request(`/families/${familyId}`),

  // Create family
  create: (schoolId, data) =>
    request(`/families/school/${schoolId}`, { method: 'POST', body: JSON.stringify(data) }),

  // Update family
  update: (familyId, data) =>
    request(`/families/${familyId}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Combined billing
  getBilling: (familyId) => request(`/families/${familyId}/billing`),

  // Members
  addMember: (familyId, userId, familyRole) =>
    request(`/families/${familyId}/members`, { method: 'POST', body: JSON.stringify({ userId, familyRole }) }),
  updateMember: (memberId, familyRole) =>
    request(`/families/members/${memberId}`, { method: 'PATCH', body: JSON.stringify({ familyRole }) }),
  removeMember: (memberId) =>
    request(`/families/members/${memberId}`, { method: 'DELETE' }),
};

// ─── Student Portal ──────────────────────────────────────

export const studentPortalApi = {
  getDashboard: () => request('/student-portal/dashboard'),
  getSchedule: (params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/student-portal/schedule${query}`);
  },
};
