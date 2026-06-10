const BASE = process.env.REACT_APP_API_ENDPOINT || 'http://localhost:4000';

function getHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(method, path, body) {
  const headers = getHeaders();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'Request failed');
  }
  return res.json();
}

// ── Auth (public, no token needed) ───────────────────────────
export const login = (email, password) =>
  request('POST', '/auth/login', { email, password });
export const register = (data) =>
  request('POST', '/auth/register', data);
export const forgotPassword = (email) =>
  request('POST', '/auth/forgot-password', { email });
export const resetPassword = (token, newPassword) =>
  request('POST', '/auth/reset-password', { token, newPassword });

// ── Projects ─────────────────────────────────────────────────
export const getProjects = () => request('GET', '/api/projects');
export const createProject = (data) => request('POST', '/api/projects', data);

// ── Builders ─────────────────────────────────────────────────
export const getBuilders = (projectId) =>
  request('GET', `/api/projects/${projectId}/builders`);
export const createBuilder = (projectId, data) =>
  request('POST', `/api/projects/${projectId}/builders`, data);
export const updateBuilder = (id, data) =>
  request('PUT', `/api/builders/${id}`, data);
export const deleteBuilder = (id) =>
  request('DELETE', `/api/builders/${id}`);

// ── Contracts ────────────────────────────────────────────────
export const getContracts = (projectId) =>
  request('GET', `/api/projects/${projectId}/contracts`);
export const createContract = (projectId, data) =>
  request('POST', `/api/projects/${projectId}/contracts`, data);
export const updateContract = (id, data) =>
  request('PUT', `/api/contracts/${id}`, data);
export const deleteContract = (id) =>
  request('DELETE', `/api/contracts/${id}`);

// ── Tranches ─────────────────────────────────────────────────
export const getTranches = (contractId) =>
  request('GET', `/api/contracts/${contractId}/tranches`);
export const createTranche = (contractId, data) =>
  request('POST', `/api/contracts/${contractId}/tranches`, data);
export const updateTranche = (id, data) =>
  request('PUT', `/api/tranches/${id}`, data);
export const deleteTranche = (id) =>
  request('DELETE', `/api/tranches/${id}`);

// ── Dashboard ────────────────────────────────────────────────
export const getDashboard = (projectId, days = 90) =>
  request('GET', `/api/projects/${projectId}/dashboard?days=${days}`);

// ── Cash Flow ────────────────────────────────────────────────
export const getCashFlow = (projectId) =>
  request('GET', `/api/projects/${projectId}/cashflow`);

// ── Payments (Receivables) ───────────────────────────────────
export const getPayments = (projectId) =>
  request('GET', `/api/projects/${projectId}/payments`);
export const createPayment = (projectId, data) =>
  request('POST', `/api/projects/${projectId}/payments`, data);
export const updatePayment = (id, data) =>
  request('PUT', `/api/payments/${id}`, data);
export const deletePayment = (id) =>
  request('DELETE', `/api/payments/${id}`);

// ── Expenses ─────────────────────────────────────────────────
export const getExpenses = (projectId) =>
  request('GET', `/api/projects/${projectId}/expenses`);
export const createExpense = (projectId, data) =>
  request('POST', `/api/projects/${projectId}/expenses`, data);
export const updateExpense = (id, data) =>
  request('PUT', `/api/expenses/${id}`, data);
export const deleteExpense = (id) =>
  request('DELETE', `/api/expenses/${id}`);

// ── P&L ──────────────────────────────────────────────────────
export const getPnL = (projectId) =>
  request('GET', `/api/projects/${projectId}/pnl`);

// ── Documents ────────────────────────────────────────────────
export const getDocuments = (projectId) =>
  request('GET', `/api/projects/${projectId}/documents`);
export const getUploadUrl = (projectId, filename, contentType) =>
  request('POST', `/api/projects/${projectId}/documents/upload-url`, { filename, content_type: contentType });
export const getDownloadUrl = (projectId, key) =>
  request('POST', `/api/projects/${projectId}/documents/download-url`, { key });
export const deleteDocument = (projectId, key) =>
  request('DELETE', `/api/projects/${projectId}/documents`, { key });

// ── Users (admin) ────────────────────────────────────────────
export const getUsers = () => request('GET', '/api/users');
export const updateUser = (id, data) => request('PUT', `/api/users/${id}`, data);
export const deleteUser = (id) => request('DELETE', `/api/users/${id}`);
export const assignCommunities = (userId, projectIds) =>
  request('PUT', `/api/users/${userId}/communities`, { project_ids: projectIds });
export const generateInvite = (role) =>
  request('POST', '/auth/invite', { role });
export const getMyCommunities = () => request('GET', '/api/my/communities');
