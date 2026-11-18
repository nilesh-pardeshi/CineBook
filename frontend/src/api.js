const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export const tokenStore = {
  get: () => localStorage.getItem('cb_token'),
  set: (t) => localStorage.setItem('cb_token', t),
  clear: () => localStorage.removeItem('cb_token'),
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function messageFrom(data) {
  if (!data) return null;
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((e) => {
        const field = (e.loc || []).slice(1).join('.');
        return `${field ? field + ': ' : ''}${String(e.msg || '').replace('Value error, ', '')}`;
      })
      .join('; ');
  }
  return null;
}

async function request(method, path, body) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError('Cannot reach the server. Please check your connection and try again.', 0);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    if (res.status === 401 && token) window.dispatchEvent(new Event('cb:unauthorized'));
    throw new ApiError(messageFrom(data) || `Something went wrong (${res.status})`, res.status);
  }
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b = {}) => request('POST', p, b),
  put: (p, b = {}) => request('PUT', p, b),
  del: (p) => request('DELETE', p),
};

export const qs = (obj) => {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : '';
};
