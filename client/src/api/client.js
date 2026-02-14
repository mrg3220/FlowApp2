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
