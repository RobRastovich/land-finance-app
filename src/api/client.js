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

// ── Projects ─────────────────────────────────────────────────
export const getProjects = () => request('GET', '/api/projects');

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
