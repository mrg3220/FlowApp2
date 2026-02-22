const API_BASE = '/api';

// ─── Refresh token queue ─────────────────────────────────
// Prevents multiple concurrent refresh requests when several
// API calls fail with 401 at the same time.
let isRefreshing = false;
let refreshSubscribers = [];

function onTokenRefreshed(newToken) {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb) {
  refreshSubscribers.push(cb);
}

/**
 * Attempts to refresh the access token using the stored refresh token.
 * Returns the new access token on success, or null on failure.
 */
async function attemptTokenRefresh() {
  const refreshToken = localStorage.getItem('flowapp_refresh_token');
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      // Refresh failed — clear everything and force login
      clearAuthStorage();
      return null;
    }

    const data = await response.json();
    localStorage.setItem('flowapp_token', data.token);
    localStorage.setItem('flowapp_refresh_token', data.refreshToken);
    localStorage.setItem('flowapp_user', JSON.stringify(data.user));
    return data.token;
  } catch {
    clearAuthStorage();
    return null;
  }
}

function clearAuthStorage() {
  localStorage.removeItem('flowapp_token');
  localStorage.removeItem('flowapp_refresh_token');
  localStorage.removeItem('flowapp_user');
}

/**
 * Generic fetch wrapper with auth token handling and auto-refresh.
 *
 * On 401: transparently attempts to refresh the access token.
 * If refresh succeeds, retries the original request.
 * If refresh fails, redirects to /login.
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

  // ─── Auto-refresh on 401 ────────────────────────────
  if (response.status === 401) {
    // Don't try to refresh the /auth/refresh endpoint itself
    if (endpoint === '/auth/refresh' || endpoint === '/auth/login') {
      clearAuthStorage();
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    if (!isRefreshing) {
      isRefreshing = true;
      const newToken = await attemptTokenRefresh();
      isRefreshing = false;

      if (newToken) {
        onTokenRefreshed(newToken);
        // Retry the original request with the new token
        config.headers.Authorization = `Bearer ${newToken}`;
        const retryResponse = await fetch(`${API_BASE}${endpoint}`, config);
        const retryData = await retryResponse.json();
        if (!retryResponse.ok) {
          const error = new Error(retryData.error || 'Request failed');
          error.status = retryResponse.status;
          throw error;
        }
        return retryData;
      } else {
        // Refresh failed — force login
        window.location.href = '/login';
        throw new Error('Session expired');
      }
    } else {
      // Another refresh is in progress — wait for it
      return new Promise((resolve, reject) => {
        addRefreshSubscriber(async (newToken) => {
          try {
            config.headers.Authorization = `Bearer ${newToken}`;
            const retryResponse = await fetch(`${API_BASE}${endpoint}`, config);
            const retryData = await retryResponse.json();
            if (!retryResponse.ok) {
              const error = new Error(retryData.error || 'Request failed');
              error.status = retryResponse.status;
              throw error;
            }
            resolve(retryData);
          } catch (err) {
            reject(err);
          }
        });
      });
    }
  }

  const data = await response.json();

  if (!response.ok) {
    const message = data.error || 'Request failed';
    const error = new Error(message);
    error.status = response.status;
    error.endpoint = endpoint;
    error.details = data;
    throw error;
  }

  return data;
}

/**
 * Unwraps paginated API responses to return just the data array.
 * Handles both new paginated format {data: [], pagination: {...}} and legacy plain arrays.
 * @param {Promise} requestPromise - The promise from request()
 * @returns {Promise<Array>} - Just the data array
 */
async function requestArray(endpoint, options = {}) {
  const result = await request(endpoint, options);
  // Handle paginated response: {data: [...], pagination: {...}}
  if (result && typeof result === 'object' && Array.isArray(result.data)) {
    return result.data;
  }
  // Handle legacy plain array response
  if (Array.isArray(result)) {
    return result;
  }
  // Fallback: return empty array if unexpected format
  console.warn('Unexpected API response format:', endpoint, result);
  return [];
}

// ─── Auth ────────────────────────────────────────────────

export const authApi = {
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  register: (data) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  refresh: (refreshToken) =>
    request('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }),

  logout: (refreshToken) =>
    request('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),

  getMe: () => request('/auth/me'),
};

// ─── Schools ─────────────────────────────────────────────

export const schoolApi = {
  getAll: () => requestArray('/schools'),

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
    return requestArray(`/enrollments${query}`);
  },

  getSchoolStudents: (schoolId) => requestArray(`/enrollments/school/${schoolId}/students`),

  enroll: (studentId, schoolId) =>
    request('/enrollments', { method: 'POST', body: JSON.stringify({ studentId, schoolId }) }),

  transfer: (studentId, toSchoolId) =>
    request('/enrollments/transfer', { method: 'POST', body: JSON.stringify({ studentId, toSchoolId }) }),

  deactivate: (id) =>
    request(`/enrollments/${id}/deactivate`, { method: 'PUT' }),
};

// ─── Programs (formerly Classes) ─────────────────────────
// Program offerings - scheduled class types with instructors and schedules

export const programApi = {
  getAll: (params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return requestArray(`/programs${query}`);
  },

  getById: (id) => request(`/programs/${id}`),

  create: (data) =>
    request('/programs', { method: 'POST', body: JSON.stringify(data) }),

  update: (id, data) =>
    request(`/programs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id) =>
    request(`/programs/${id}`, { method: 'DELETE' }),

  // Schedule management
  addSchedule: (programId, data) =>
    request(`/programs/${programId}/schedules`, { method: 'POST', body: JSON.stringify(data) }),

  updateSchedule: (programId, scheduleId, data) =>
    request(`/programs/${programId}/schedules/${scheduleId}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteSchedule: (programId, scheduleId) =>
    request(`/programs/${programId}/schedules/${scheduleId}`, { method: 'DELETE' }),

  // Get available curricula for linking
  getCurricula: (params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return requestArray(`/programs/curricula${query}`);
  },
};

// Legacy alias for backward compatibility
export const classApi = programApi;

// ─── Classes (formerly Sessions) ─────────────────────────
// Individual class meetings on specific dates

export const classInstanceApi = {
  getAll: (params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return requestArray(`/class-instances${query}`);
  },

  getById: (id) => request(`/class-instances/${id}`),

  create: (data) =>
    request('/class-instances', { method: 'POST', body: JSON.stringify(data) }),

  updateStatus: (id, status) =>
    request(`/class-instances/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  getQr: (id) => request(`/class-instances/${id}/qr`),
};

// Legacy alias for backward compatibility
export const sessionApi = classInstanceApi;

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
    return requestArray(`/users${query}`);
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
    return requestArray(`/billing/plans/${schoolId}${query}`);
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
    return requestArray(`/billing/invoices/${schoolId}${query}`);
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
    return requestArray(`/billing/payments/${schoolId}${query}`);
  },
  recordPayment: (schoolId, data) =>
    request(`/billing/payments/${schoolId}`, { method: 'POST', body: JSON.stringify(data) }),

  // Summary
  getSummary: (schoolId) => request(`/billing/summary/${schoolId}`),

  // Subscriptions
  getSubscriptions: (schoolId, params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return requestArray(`/billing/subscriptions/${schoolId}${query}`);
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
    return requestArray(`/promotions/programs${query}`);
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
    return requestArray(`/promotions/enrollments/${schoolId}${query}`);
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
    return requestArray(`/promotions/tests/${schoolId}${query}`);
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
  getMine: () => requestArray('/families/mine'),

  // School families (staff)
  getBySchool: (schoolId, params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return requestArray(`/families/school/${schoolId}${query}`);
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
    return requestArray(`/student-portal/schedule${query}`);
  },
};

// ─── Leads / CRM ─────────────────────────────────────────

export const leadApi = {
  getBySchool: (schoolId, params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return requestArray(`/leads/school/${schoolId}${query}`);
  },
  getById: (id) => request(`/leads/${id}`),
  create: (schoolId, data) => request(`/leads/school/${schoolId}`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  addActivity: (id, data) => request(`/leads/${id}/activity`, { method: 'POST', body: JSON.stringify(data) }),
  getFunnel: (schoolId) => request(`/leads/school/${schoolId}/funnel`),
  remove: (id) => request(`/leads/${id}`, { method: 'DELETE' }),
};

// ─── Curriculum ──────────────────────────────────────────

export const curriculumApi = {
  getAll: (params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return requestArray(`/curriculum${query}`);
  },
  getBySchool: (schoolId, params) => {
    const query = new URLSearchParams({ ...(params || {}), schoolId }).toString();
    return requestArray(`/curriculum?${query}`);
  },
  getById: (id) => request(`/curriculum/${id}`),
  getCategories: () => request('/curriculum/categories'),
  create: (schoolIdOrData, data) => {
    const payload = data ? { ...data, schoolId: schoolIdOrData } : schoolIdOrData;
    return request('/curriculum', { method: 'POST', body: JSON.stringify(payload) });
  },
  update: (id, data) => request(`/curriculum/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/curriculum/${id}`, { method: 'DELETE' }),
  remove: (id) => request(`/curriculum/${id}`, { method: 'DELETE' }),
};

// ─── Financial Reporting ─────────────────────────────────

function mapRevenueDashboard(data) {
  const revenueByMonth = Object.entries(data.revenueByMonth || {}).map(([month, revenue]) => ({
    month,
    revenue,
    count: 0,
  }));
  const invoicesByStatus = (data.invoicesByStatus || []).map((s) => ({
    status: s.status,
    _count: s.count,
    _sum: { totalAmount: s.amount },
  }));
  const revenueByPlan = (data.revenueByPlan || []).map((p) => ({
    planName: p.planName,
    revenue: p.amount,
    count: p.count,
  }));

  return {
    totalRevenue: data.totalRevenue,
    outstandingBalance: data.outstandingBalance,
    activeSubscriptions: data.activeSubscriptions,
    revenueByMonth,
    invoicesByStatus,
    revenueByPlan,
  };
}

function mapPaymentStats(rows) {
  return (rows || []).map((p) => ({
    paymentMethod: p.method,
    _count: p.count,
    _sum: { totalAmount: p.amount },
  }));
}

function mapBySchool(rows) {
  return (rows || []).map((r) => ({
    schoolId: r.schoolId,
    schoolName: r.schoolName,
    totalRevenue: r.revenue,
    outstanding: 0,
    invoiceCount: r.invoiceCount,
  }));
}

export const reportingApi = {
  getDashboard: (schoolId, params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/reporting/revenue/${schoolId}${query}`).then(mapRevenueDashboard);
  },
  getBySchool: () => request('/reporting/revenue-by-school').then(mapBySchool),
  getPaymentStats: (schoolId) => request(`/reporting/payment-methods/${schoolId}`).then(mapPaymentStats),
  getRevenue: (schoolId, params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return requestArray(`/reporting/revenue/${schoolId}${query}`);
  },
  getRevenueBySchool: () => request('/reporting/revenue-by-school'),
  getPaymentMethods: (schoolId) => request(`/reporting/payment-methods/${schoolId}`),
};

// ─── Waivers ─────────────────────────────────────────────

export const waiverApi = {
  getMine: () => request('/waivers/mine'),
  sign: (id, data) => request(`/waivers/${id}/sign`, { method: 'PUT', body: JSON.stringify(data) }),
  getTemplates: (schoolId) => requestArray(`/waivers/templates/${schoolId}`),
  createTemplate: (schoolId, data) => request(`/waivers/templates/${schoolId}`, { method: 'POST', body: JSON.stringify(data) }),
  updateTemplate: (id, data) => request(`/waivers/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getBySchool: (schoolId, params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return requestArray(`/waivers/school/${schoolId}${query}`);
  },
  send: (data) => request('/waivers/send', { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Retail / Inventory ──────────────────────────────────

export const retailApi = {
  getProducts: (schoolId, params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return requestArray(`/retail/products/${schoolId}${query}`);
  },
  createProduct: (schoolId, data) => request(`/retail/products/${schoolId}`, { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id, data) => request(`/retail/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateInventory: (productId, data) => request(`/retail/inventory/${productId}`, { method: 'PUT', body: JSON.stringify(data) }),
  getLowStock: (schoolId) => requestArray(`/retail/low-stock/${schoolId}`),
  getOrders: (schoolId, params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return requestArray(`/retail/orders/${schoolId}${query}`);
  },
  createOrder: (schoolId, data) => request(`/retail/orders/${schoolId}`, { method: 'POST', body: JSON.stringify(data) }),
  updateOrderStatus: (id, status) => request(`/retail/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};

// ─── Certificates ────────────────────────────────────────

export const certificateApi = {
  getTemplates: (schoolId) => requestArray(`/certificates/templates/${schoolId || ''}`),
  getCertificates: (schoolId) => requestArray(`/certificates?schoolId=${schoolId}`),
  createTemplate: (schoolId, data) => request('/certificates/templates', { method: 'POST', body: JSON.stringify({ ...data, schoolId }) }),
  updateTemplate: (id, data) => request(`/certificates/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTemplate: (id) => request(`/certificates/templates/${id}`, { method: 'DELETE' }),
  getAll: (params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return requestArray(`/certificates${query}`);
  },
  generate: (data) => request('/certificates/generate', { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Training Plans ──────────────────────────────────────

export const trainingPlanApi = {
  getMyPlans: () => requestArray('/training-plans/mine'),
  getBySchool: (schoolId) => requestArray(`/training-plans/school/${schoolId}`),
  getById: (id) => request(`/training-plans/${id}`),
  create: (schoolId, data) => request(`/training-plans/school/${schoolId}`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/training-plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/training-plans/${id}`, { method: 'DELETE' }),
  addExercise: (planId, data) => request(`/training-plans/${planId}/exercises`, { method: 'POST', body: JSON.stringify(data) }),
  updateExercise: (id, data) => request(`/training-plans/exercises/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteExercise: (id) => request(`/training-plans/exercises/${id}`, { method: 'DELETE' }),
  assign: (planId, data) => request(`/training-plans/${planId}/assign`, { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Payroll ─────────────────────────────────────────────

export const payrollApi = {
  getEntries: (schoolId, params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return requestArray(`/payroll/school/${schoolId}${query}`);
  },
  getSummary: (schoolId, params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return requestArray(`/payroll/summary/${schoolId}${query}`);
  },
  create: (schoolId, data) => request(`/payroll/school/${schoolId}`, { method: 'POST', body: JSON.stringify(data) }),
  approve: (ids) => request('/payroll/approve', { method: 'POST', body: JSON.stringify({ ids }) }),
  markPaid: (ids) => request('/payroll/mark-paid', { method: 'POST', body: JSON.stringify({ ids }) }),
  remove: (id) => request(`/payroll/${id}`, { method: 'DELETE' }),
};

// ─── Events ──────────────────────────────────────────────
export const eventApi = {
  getAll: (params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return requestArray(`/events${query}`);
  },
  getById: (id) => request(`/events/${id}`),
  create: (data) => request('/events', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/events/${id}`, { method: 'DELETE' }),
  purchaseTicket: (eventId, data) => request(`/events/${eventId}/tickets`, { method: 'POST', body: JSON.stringify(data) }),
  updateTicketStatus: (ticketId, status) => request(`/events/tickets/${ticketId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  register: (eventId, data) => request(`/events/${eventId}/register`, { method: 'POST', body: JSON.stringify(data || {}) }),
  cancelRegistration: (regId) => request(`/events/registrations/${regId}`, { method: 'DELETE' }),
  addTournamentEntry: (eventId, data) => request(`/events/${eventId}/tournament-entries`, { method: 'POST', body: JSON.stringify(data) }),
  updateTournamentEntry: (entryId, data) => request(`/events/tournament-entries/${entryId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTournamentEntry: (entryId) => request(`/events/tournament-entries/${entryId}`, { method: 'DELETE' }),
  getStudentMedals: (studentId) => request(`/events/student/${studentId}/medals`),
};

// ─── Venues ──────────────────────────────────────────────
export const venueApi = {
  getAll: (params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return requestArray(`/venues${query}`);
  },
  getById: (id) => request(`/venues/${id}`),
  create: (data) => request('/venues', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/venues/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/venues/${id}`, { method: 'DELETE' }),
};

// ─── Certifications / Title Applications ─────────────────
export const certificationApi = {
  getAll: (params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return requestArray(`/certifications${query}`);
  },
  getById: (id) => request(`/certifications/${id}`),
  create: (data) => request('/certifications', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/certifications/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  submit: (id) => request(`/certifications/${id}/submit`, { method: 'POST' }),
  withdraw: (id) => request(`/certifications/${id}/withdraw`, { method: 'POST' }),
  review: (id, data) => request(`/certifications/${id}/review`, { method: 'POST', body: JSON.stringify(data) }),
  markPaid: (id) => request(`/certifications/${id}/mark-paid`, { method: 'POST' }),
};

// ─── Branding ────────────────────────────────────────────
export const brandingApi = {
  getOrg: () => request('/branding/org'),
  updateOrg: (data) => request('/branding/org', { method: 'PUT', body: JSON.stringify(data) }),
  getSchool: (schoolId) => request(`/branding/school/${schoolId}`),
  updateSchool: (schoolId, data) => request(`/branding/school/${schoolId}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// ─── Help / AI Chat ──────────────────────────────────────
export const helpApi = {
  getArticles: (params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return requestArray(`/help/articles${query}`);
  },
  getArticle: (id) => request(`/help/articles/${id}`),
  getCategories: () => request('/help/articles/categories'),
  createArticle: (data) => request('/help/articles', { method: 'POST', body: JSON.stringify(data) }),
  updateArticle: (id, data) => request(`/help/articles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteArticle: (id) => request(`/help/articles/${id}`, { method: 'DELETE' }),
  getOnboarding: () => request('/help/onboarding'),
  completeStep: (stepKey) => request('/help/onboarding', { method: 'POST', body: JSON.stringify({ stepKey }) }),
  chat: (message, history) => request('/help/chat', { method: 'POST', body: JSON.stringify({ message, conversationHistory: history }) }),
};

// ─── Public (no auth) ────────────────────────────────────

async function publicRequest(endpoint, options = {}) {
  const config = { headers: { 'Content-Type': 'application/json', ...options.headers }, ...options };
  const response = await fetch(`${API_BASE}${endpoint}`, config);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const publicApi = {
  getEvents: (params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return publicRequest(`/public/events${query}`);
  },
  getEvent: (id) => publicRequest(`/public/events/${id}`),
  purchaseTicket: (data) => publicRequest('/public/events/tickets', { method: 'POST', body: JSON.stringify(data) }),
  getProducts: (params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return publicRequest(`/public/shop${query}`);
  },
  createOrder: (data) => publicRequest('/public/shop/orders', { method: 'POST', body: JSON.stringify(data) }),
  getSchools: () => publicRequest('/public/schools'),
};

// ─── Virtual / Online Classes ────────────────────────────

export const virtualApi = {
  getContent: (params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return requestArray(`/virtual${query}`);
  },
  getBySchool: (schoolId, params) => {
    const query = new URLSearchParams({ ...(params || {}), schoolId }).toString();
    return requestArray(`/virtual?${query}`);
  },
  getById: (id) => request(`/virtual/${id}`),
  getStats: (id) => request(`/virtual/${id}/stats`),
  create: (schoolIdOrData, data) => {
    const payload = data ? { ...data, schoolId: schoolIdOrData } : schoolIdOrData;
    return request('/virtual', { method: 'POST', body: JSON.stringify(payload) });
  },
  update: (id, data) => request(`/virtual/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/virtual/${id}`, { method: 'DELETE' }),
  remove: (id) => request(`/virtual/${id}`, { method: 'DELETE' }),
  recordView: (id, data) => request(`/virtual/${id}/view`, { method: 'POST', body: JSON.stringify(data) }),
  getMyViews: () => request('/virtual/my-views'),
};

// ─── IT Admin ────────────────────────────────────────────

export const adminApi = {
  getStats: () => request('/admin/stats'),

  // User management
  getUsers: (params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/admin/users${query}`);
  },
  getUser: (id) => request(`/admin/users/${id}`),
  createUser: (data) => request('/admin/users/create', { method: 'POST', body: JSON.stringify(data) }),
  changeRole: (id, role) => request(`/admin/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
  disableUser: (id, reason) => request(`/admin/users/${id}/disable`, { method: 'PUT', body: JSON.stringify({ reason }) }),
  enableUser: (id) => request(`/admin/users/${id}/enable`, { method: 'PUT' }),
  resetPassword: (id, newPassword) => request(`/admin/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword }) }),

  // Audit logs
  getAuditLogs: (params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/admin/audit-logs${query}`);
  },

  // System settings
  getSettings: (params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/admin/settings${query}`);
  },
  upsertSetting: (key, data) => request(`/admin/settings/${key}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// ─── SRE / Observability ─────────────────────────────────

export const sreApi = {
  getDashboard: () => request('/sre/dashboard'),
  getHealth: () => request('/sre/health'),
  getDatabase: () => request('/sre/database'),
  getRequests: () => request('/sre/requests'),
  getErrors: (params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return requestArray(`/sre/errors${query}`);
  },
  getRuntime: () => request('/sre/runtime'),
};
