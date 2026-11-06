// Small client for the WellBridge API. Use from the page: import { WB } from './api.js'
async function api(path, method = 'GET', body) {
  let r;
  try {
    r = await fetch('/api' + path, {
      method, credentials: 'same-origin',
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch { throw Object.assign(new Error('Cannot reach the server. Check your connection and try again.'), { status: 0, data: {} }); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || (r.status === 404 ? 'The server part of the app is not found (404). Check the Netlify functions deployed.' : 'Something went wrong (' + r.status + ').')), { status: r.status, data: d });
  return d;
}
export const WB = {
  config: () => api('/config'),
  profile: phone => api('/me/profile', 'PUT', { phone }),
  chat: messages => api('/chat', 'POST', { messages }),
  slots: counselorId => api('/slots?counselorId=' + counselorId),
  cancel: id => api('/bookings/' + id, 'DELETE'),
  signup: b => api('/auth/signup', 'POST', b),
  login: b => api('/auth/login', 'POST', b),
  google: (credential, acceptTerms) => api('/auth/google', 'POST', { credential, acceptTerms }),
  logout: () => api('/auth/logout', 'POST', {}),
  forgot: email => api('/auth/forgot', 'POST', { email }),
  reset: (token, password) => api('/auth/reset', 'POST', { token, password }),
  me: () => api('/me'),
  setConsent: careContact => api('/consent', 'PUT', { careContact }),
  checkin: b => api('/checkins', 'POST', b),
  history: () => api('/checkins'),
  counselors: () => api('/counselors'),
  book: b => api('/bookings', 'POST', b),
  bookings: () => api('/bookings'),
  myAlert: () => api('/alerts/mine'),
  replyAsStudent: (id, body) => api(`/alerts/${id}/messages`, 'POST', { body }),
  exportData: () => api('/me/export'),
  deleteAccount: () => api('/me', 'DELETE'),
  careApply: b => api('/care/apply', 'POST', b),
  careAlerts: () => api('/care/alerts'),
  careMessages: id => api(`/care/alerts/${id}/messages`),
  careReply: (id, body) => api(`/care/alerts/${id}/messages`, 'POST', { body }),
  careEscalate: id => api(`/care/alerts/${id}/escalate`, 'POST', {}),
  trends: () => api('/trends'),
  applicants: () => api('/admin/care-applicants'),
  decide: (id, approve) => api(`/admin/care/${id}/${approve ? 'approve' : 'reject'}`, 'POST', {}),
};
