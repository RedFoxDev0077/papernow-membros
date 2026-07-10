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
  logout: () => request('POST', '/api/auth/logout'),
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
  deleteNote: (id) => request('DELETE', `/api/notes/${id}`),
};
