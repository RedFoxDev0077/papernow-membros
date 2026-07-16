// Cliente HTTP simples para a API da área de membros.
async function request(method, url, body, isForm = false) {
  const opts = { method, headers: {}, credentials: 'same-origin' };
  if (body != null) {
    if (isForm) opts.body = body;
    else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  }
  const res = await fetch(url, opts);
  let data = null;
  try { data = await res.json(); } catch { /* sem corpo */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || 'Erro na requisição.');
    err.status = res.status; err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (u) => request('GET', u),
  post: (u, b) => request('POST', u, b),
  put: (u, b) => request('PUT', u, b),
  patch: (u, b) => request('PATCH', u, b),
  del: (u) => request('DELETE', u),
  upload: (u, form) => request('POST', u, form, true),

  // Auth
  me: () => request('GET', '/api/auth/me'),
  checkAccess: (payload) => request('POST', '/api/auth/check-access', payload),
  register: (payload) => request('POST', '/api/auth/register', payload),
  login: (payload) => request('POST', '/api/auth/login', payload),
  login2fa: (ticket, code) => request('POST', '/api/auth/login/2fa', { ticket, code }),
  logout: () => request('POST', '/api/auth/logout'),
  twofaStatus: () => request('GET', '/api/auth/2fa/status'),
  twofaSetup: () => request('POST', '/api/auth/2fa/setup'),
  twofaEnable: (code) => request('POST', '/api/auth/2fa/enable', { code }),
  twofaDisable: (code) => request('POST', '/api/auth/2fa/disable', { code }),
  twofaRecovery: (code) => request('POST', '/api/auth/2fa/recovery', { code }),
  forgot: (email) => request('POST', '/api/auth/forgot', { email }),
  reset: (token, password) => request('POST', '/api/auth/reset', { token, password }),

  // Dados
  dashboard: () => request('GET', '/api/dashboard'),
  calendar: () => request('GET', '/api/calendar'),
  photos: (week) => request('GET', `/api/photos${week ? `?week=${week}` : ''}`),
  deletePhoto: (id) => request('DELETE', `/api/photos/${id}`),
  notes: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return request('GET', `/api/notes${q ? `?${q}` : ''}`);
  },
  createNote: (n) => request('POST', '/api/notes', n),
  updateNote: (id, n) => request('PUT', `/api/notes/${id}`, n),
  toggleNoteDone: (id, done) => request('PATCH', `/api/notes/${id}/done`, { done }),
  deleteNote: (id) => request('DELETE', `/api/notes/${id}`),
  setMotto: (motto) => request('PUT', '/api/dashboard/motto', { motto }),
  content: (section) => request('GET', `/api/content?section=${section}`),
  retrospectiva: () => request('GET', '/api/retrospectiva'),
  getLegend: () => request('GET', '/api/legend'),
  setLegend: (legend) => request('PUT', '/api/legend', { legend }),
  payments: (ym) => request('GET', `/api/payments?ym=${ym}`),
  addPayment: (title, amount) => request('POST', '/api/payments', { title, amount }),
  updatePayment: (id, data) => request('PUT', `/api/payments/${id}`, data),
  deletePayment: (id) => request('DELETE', `/api/payments/${id}`),
  checkPayment: (id, ym, paid) => request('PUT', `/api/payments/${id}/check`, { ym, paid }),
  agenda: (params = {}) => { const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString(); return request('GET', `/api/agenda${q ? `?${q}` : ''}`); },
  addEvent: (e) => request('POST', '/api/agenda', e),
  updateEvent: (id, e) => request('PUT', `/api/agenda/${id}`, e),
  deleteEvent: (id) => request('DELETE', `/api/agenda/${id}`),
};
