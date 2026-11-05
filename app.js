import { WB } from './api.js';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2600); }
const fmtD = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const fmtDT = d => new Date(d).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' });
const PH = '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/></svg>';
const CAUSE = { a: 'Exams', b: 'Money', c: 'Lonely', d: 'Future', e: 'Other' };
const CRISIS = /suicid|kill myself|end my life|self.?harm|hurt myself|want to die|don.t want to live/i;

let me = null, cfg = { contacts: {} }, googleOK = false, mode = 'up', resetToken = null;
let hist = [], bookings = [], counselors = [], alertData = { alert: null, messages: [] };
let consent = false, share = false, queue = [], selAlert = null;
const ci = {}, bk = { k: 'In person' };

/* ---------- navigation ---------- */
function go(v) {
  if (me && me.role !== 'student') v = 'staff';
  if (v === 'staff' && (!me || me.role === 'student')) v = 'home';
  $$('.view').forEach(e => e.classList.toggle('on', e.id === v));
  $$('.tab').forEach(b => { b.removeAttribute('aria-current'); if (b.dataset.go === v) b.setAttribute('aria-current', 'page'); });
  window.scrollTo(0, 0);
}
const currentView = () => $('.view.on')?.id;
document.addEventListener('click', e => {
  const t = e.target; let x;
  if ((x = t.closest('[data-go]'))) go(x.dataset.go);
  if (t.closest('[data-sos]')) openSos();
  if ((x = t.closest('[data-mode]'))) { e.preventDefault(); setMode(x.dataset.mode); $('#auth').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  if (t.closest('[data-signout]')) signOut();
  if ((x = t.closest('[data-legal]'))) { e.preventDefault(); showLegal(x.dataset.legal); }
  if (t.closest('[data-faq]')) { e.preventDefault(); $('#faq').showModal(); }
  if (t.closest('[data-staff]')) $('#apply').showModal();
  if (t.closest('#consentChk') || t.closest('#consentJ')) toggleConsent();
  if (t.closest('#sSend')) sendStudent();
  if (t.closest('#shareB')) { share = !share; renderBmood(); }
  if (t.closest('#phoneSave')) savePhone();
  if (t.closest('#exportBtn')) exportData();
  if (t.closest('#delBtn')) deleteAccount();
  if ((x = t.closest('[data-cancel]'))) cancelBooking(x.dataset.cancel);
  if ((x = t.closest('[data-q]'))) openAlert(x.dataset.q);
  if ((x = t.closest('[data-qr]'))) careSend(x.dataset.qr);
  if (t.closest('#cSend')) careSend($('#cReply').value);
  if (t.closest('#escal')) escalate();
  if ((x = t.closest('[data-ap]'))) decide(x.dataset.id, x.dataset.ap === '1');
});
$('#closeSos').onclick = () => $('#sos').close();
$('#faqX').onclick = () => $('#faq').close();
$('#lClose').onclick = () => $('#legal').close();
$('#apX').onclick = () => $('#apply').close();
async function signOut() { try { await WB.logout(); } catch {} location.replace('/'); }

/* ---------- urgent help ---------- */
function openSos() {
  const c = cfg.contacts || {};
  const rows = [['em', 'Emergency services', 'Danger or medical emergency', '112'], ['', 'Campus security', 'On campus', c.security],
    ['', 'Crisis helpline', 'Free and confidential', c.crisis], ['', 'Student counseling line', 'Counseling center', c.counseling]].filter(r => r[3]);
  $('#sosList').innerHTML = rows.map(([cls, t, sub, n]) => `<a class="call ${cls}" href="tel:${esc(n.replace(/[^\d+]/g, ''))}"><span class="ci">${PH}</span><span style="flex:1"><b>${t}</b><small>${sub}</small></span><b class="num">${esc(n)}</b></a>`).join('');
  $('#sos').showModal();
}

/* ---------- legal ---------- */
const P = t => t.map(([h, b]) => `<h3>${h}</h3>${[].concat(b).map(x => `<p>${x}</p>`).join('')}`).join('');
const legal = {
  terms: ['Terms of Use', () => P([
    ['1. About WellBridge', 'WellBridge is a free wellbeing app for university students. You can check in on how you feel, see your mood over time, book a counselor, read self-help guides, chat with an AI assistant and, if you choose, be contacted by a verified care team.'],
    ['2. Who can use it', 'WellBridge is for enrolled university students. Care team members and admins use separate accounts that we approve first.'],
    ['3. Your account', 'Give us accurate details and keep your password private. You are responsible for what happens on your account. Tell us straight away if you think someone else has used it.'],
    ['4. Not for emergencies', 'WellBridge is not an emergency service and does not replace a doctor or therapist. If you or someone else is in immediate danger, call 112 or tap Urgent help. Care team replies are not instant, so do not wait for one in an emergency.'],
    ['5. The AI assistant', 'The assistant gives general tips and can make mistakes. It cannot diagnose, treat or handle emergencies, and its replies are not professional advice.'],
    ['6. The care team', 'Care team members are licensed professionals whose licenses we check before approving them. They only contact you if you switch on care team contact and one of your check-ins is flagged. You can switch it off at any time. If they believe your life or safety is at immediate risk, they may escalate as explained in the Privacy Policy.'],
    ['7. Bookings', 'You can book and cancel counseling slots in the app. Counselors set their own availability. We may change or cancel a slot and will tell you if we do.'],
    ['8. Acceptable use', 'Do not harass or impersonate anyone, misuse the care team or the assistant, send spam, try to reach other people’s data, or interfere with the service.'],
    ['9. What you write', 'You own what you write. You allow us to store it and show it only to the people you have allowed (for example the care team or a counselor) so the service can work.'],
    ['10. Availability', 'We work to keep WellBridge running, but it may be interrupted or change. We provide it as it is, and to the extent the law allows we are not liable for losses from using it.'],
    ['11. Ending your use', 'You can delete your account at any time in Journey, Your data. We may suspend an account that breaks these terms.'],
    ['12. Changes and contact', 'If we change these terms we will tell you in the app. Questions: ' + (cfg.contactEmail ? esc(cfg.contactEmail) : 'contact the WellBridge team') + '.'],
  ])],
  privacy: ['Privacy Policy', () => P([
    ['In short', ['We collect only what we need to run WellBridge. We never sell your data or use it for ads. The care team sees a flagged check-in only if you allow it, and only as an anonymous ID.']],
    ['1. What we collect', ['<b>Account:</b> name, email, and a hashed password or your Google sign-in ID. Optional: your phone number.', '<b>Wellbeing:</b> check-in answers (mood, stress, main cause) and the time.', '<b>Bookings:</b> counselor, time, format, and whether you shared your mood summary.', '<b>Care team:</b> your consent choices and the messages between you and the care team.', '<b>Security:</b> failed sign-in attempts (kept up to a day) and a log of every care team access.', '<b>AI chat:</b> your messages are not stored. We only count how many you send, to prevent abuse.']],
    ['2. Why we use it', 'To run your account, show your journey, make bookings, flag check-ins when you allow it, keep the service secure, and show anonymous trends so support can be planned.'],
    ['3. Who can see what', ['<b>You:</b> everything you have entered.', '<b>Counselors:</b> your mood summary, only if you choose to share it when booking.', '<b>Care team:</b> flagged check-ins and messages, only while care team contact is on, shown as an anonymous ID without your name or email.', '<b>Admins:</b> care team applications and anonymous trends. Not student messages.', '<b>Anonymous trends:</b> shown only when at least 10 students are included.']],
    ['4. Emergencies', 'If a care team member believes your life or safety is at immediate risk, they can escalate. This shares your name, email and phone number (if you saved one) with the duty officer or emergency contact so someone can reach you quickly. Each escalation is logged.'],
    ['5. Notifications', 'We may email or text you or the care team to say there is a new message or alert. These notices do not include check-in details or message content.'],
    ['6. Service providers', 'We use providers to run WellBridge: hosting (Netlify), a database host, email (Resend), SMS (Termii), the AI assistant (Anthropic) and Google sign-in. They handle data only to provide their service to us. We do not sell your data.'],
    ['7. The AI assistant', 'Your chat messages are sent to our AI provider to write a reply. We do not keep them. Please avoid sharing details that identify you or others.'],
    ['8. How long we keep data', 'We keep your data until you delete your account. Deleting it removes your profile, check-ins, bookings, messages and consent history. Care team access logs stay, without your personal details.'],
    ['9. Security', 'Connections are encrypted (HTTPS), passwords are hashed, sign-in is limited after repeated failures, and care team access is restricted and logged.'],
    ['10. Cookies', 'We use one essential cookie to keep you signed in. We use no advertising or tracking cookies. Google sign-in and fonts load from Google.'],
    ['11. Your choices', 'You can download your data, delete your account, add or remove your phone number, and switch care team contact on or off at any time in Journey. To correct or ask anything about your data, contact us.'],
    ['12. Changes and contact', 'If we change this policy we will tell you in the app. Questions: ' + (cfg.contactEmail ? esc(cfg.contactEmail) : 'contact the WellBridge team') + '.'],
  ])],
};
function showLegal(k) { $('#lTitle').textContent = legal[k][0]; $('#lBody').innerHTML = legal[k][1](); $('#legal').showModal(); }

/* ---------- auth ---------- */
function setMode(m) {
  mode = m; const up = m === 'up', rs = m === 'reset', np = m === 'newpw', g = googleOK && !rs && !np;
  $('#nameRow').hidden = !up; $('#agreeRow').hidden = !up; $('#passRow').hidden = rs; $('#emailRow').hidden = np;
  $('#gBtn').hidden = !g; $('.or').hidden = !g; $('.seg').hidden = np;
  $('#passRow').childNodes[0].nodeValue = np ? 'New password' : 'Password';
  $('#authGo').textContent = up ? 'Create account' : rs ? 'Send reset link' : np ? 'Set new password' : 'Sign in';
  $$('.seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
  $('#authMsg').textContent = ''; $('#authMsg').className = 'err';
  $('#forgotRow').innerHTML = m === 'in' ? '<a href="#" data-mode="reset">Forgot password?</a>' : rs ? '<a href="#" data-mode="in">Back to sign in</a>' : '';
  $('#aPass').autocomplete = up || np ? 'new-password' : 'current-password';
}
$('#authForm').addEventListener('submit', async e => {
  e.preventDefault();
  const er = $('#authMsg'), btn = $('#authGo'), em = $('#aEmail').value.trim(), pw = $('#aPass').value, nm = $('#aName').value.trim();
  er.className = 'err'; er.textContent = '';
  const bad = m => { er.textContent = m; };
  if (mode !== 'newpw' && !/^\S+@\S+\.\S+$/.test(em)) return bad('Enter a valid email address.');
  if (mode === 'up' && !nm) return bad('Please enter your name.');
  if (mode !== 'reset' && pw.length < 8) return bad('Password must be at least 8 characters.');
  if (mode === 'up' && !$('#aAgree').checked) return bad('Please agree to the Terms and Privacy Policy.');
  btn.disabled = true;
  try {
    if (mode === 'reset') { await WB.forgot(em); er.className = 'err ok2'; er.textContent = 'If an account exists, we sent a reset link to ' + em + '.'; }
    else if (mode === 'newpw') { await WB.reset(resetToken, pw); history.replaceState(null, '', '/'); resetToken = null; setMode('in'); er.className = 'err ok2'; er.textContent = 'Password updated. Please sign in.'; }
    else { if (mode === 'up') await WB.signup({ name: nm, email: em, password: pw, acceptTerms: true }); else await WB.login({ email: em, password: pw }); await enter((await WB.me()).user); }
  } catch (x) { er.textContent = x.message; } finally { btn.disabled = false; }
});
function initGoogle() {
  if (!cfg.googleClientId) return;
  googleOK = true; setMode(mode);
  const t = setInterval(() => {
    if (!window.google?.accounts?.id) return; clearInterval(t);
    google.accounts.id.initialize({ client_id: cfg.googleClientId, callback: async r => {
      try { await WB.google(r.credential, $('#aAgree').checked); await enter((await WB.me()).user); }
      catch (x) { $('#authMsg').className = 'err'; $('#authMsg').textContent = x.data?.needTerms ? 'Tick the box to accept the Terms, then continue with Google again.' : x.message; setMode(mode === 'in' ? 'in' : 'up'); } } });
    google.accounts.id.renderButton($('#gBtn'), { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', width: 300 });
  }, 200);
}
$('#apForm').addEventListener('submit', async e => {
  e.preventDefault(); const er = $('#apMsg'); er.className = 'err'; er.textContent = '';
  try { const r = await WB.careApply({ name: $('#apName').value, email: $('#apEmail').value, password: $('#apPass').value, licenseNo: $('#apLic').value, licenseBody: $('#apBody').value });
    er.className = 'err ok2'; er.textContent = r.message; $('#apForm').reset(); } catch (x) { er.textContent = x.message; }
});

/* ---------- entering the app ---------- */
async function enter(u) {
  me = u; document.body.classList.add('authed'); document.body.classList.toggle('staffmode', u.role !== 'student'); $('#aPass').value = '';
  if (u.role === 'student') {
    consent = u.care_contact_consent; $('#phoneIn').value = u.phone || ''; $('#hello').textContent = 'Hi ' + u.name.split(' ')[0] + ', how are you today?';
    await Promise.allSettled([loadHist(), loadBookings(), loadCounselors(), loadAlert()]); renderAll(); go('home');
  } else { go('staff'); loadCare(); }
}
async function loadHist() { hist = (await WB.history()).checkins.slice().reverse(); }
async function loadBookings() { bookings = (await WB.bookings()).bookings; }
async function loadCounselors() { counselors = (await WB.counselors()).counselors; }
async function loadAlert() { alertData = await WB.myAlert(); }
function renderAll() { renderJourney(); renderCareCard(); renderBook(); renderBookings(); }

/* ---------- chips ---------- */
function chips(id, items, cb, html) {
  const box = $(id); box.innerHTML = '';
  items.forEach(([label, val]) => {
    const b = document.createElement('button'); b.className = 'chip'; b.type = 'button'; b.dataset.v = val; b.setAttribute('aria-pressed', 'false');
    if (html) b.innerHTML = label; else b.textContent = label;
    b.onclick = () => { if (b.disabled) return; [...box.children].forEach(c => c.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); cb(val); };
    box.appendChild(b);
  });
}

/* ---------- check-in ---------- */
const mouth = ['M8 17q4-4 8 0', 'M8 16q4-2 8 0', 'M8 15h8', 'M8 14q4 3 8 0', 'M7 13q5 6 10 0'];
const face = i => `<svg viewBox="0 0 24 24" aria-label="Mood ${i + 1} of 5"><circle cx="12" cy="12" r="10"/><path d="M9 9v1M15 9v1"/><path d="${mouth[i]}"/></svg>`;
const chk = () => { $('#sendCheck').disabled = !(ci.mood && ci.stress && ci.cause); };
chips('#moods', [0, 1, 2, 3, 4].map(i => [face(i), i + 1]), v => { ci.mood = v; chk(); }, true);
chips('#stress', [['Low', 1], ['Some', 2], ['Medium', 3], ['High', 4], ['Extreme', 5]], v => { ci.stress = v; chk(); });
chips('#cause', [['Exams', 'a'], ['Money', 'b'], ['Lonely', 'c'], ['Future', 'd'], ['Other', 'e']], v => { ci.cause = v; chk(); });
$('#sendCheck').onclick = async () => {
  const btn = $('#sendCheck'); btn.disabled = true;
  try {
    const r = await WB.checkin({ mood: ci.mood, stress: ci.stress, cause: CAUSE[ci.cause] });
    await Promise.allSettled([loadHist(), loadAlert()]); renderAll();
    const res = $('#result'); res.hidden = false;
    res.innerHTML = (r.flagged
      ? `<b>That sounds heavy.</b><p>A counselor can help.</p>${r.careContact ? '<p>A verified care team member will message you in My journey.</p>' : '<p>Want a care team member to reach out? Turn on contact in My journey.</p>'}<button class="btn" data-go="book">Book now</button>`
      : '<b>Saved. Well done.</b><p>Keep sleep and breaks steady.</p><button class="btn alt" data-go="library">Guides</button>')
      + '<p style="margin:10px 0 0"><button class="btn alt" data-go="journey">View my journey</button></p>';
    toast('Check-in saved');
  } catch (x) { toast(x.message); } finally { chk(); }
};
async function toggleConsent() {
  try { consent = (await WB.setConsent(!consent)).careContact; renderCareCard(); toast(consent ? 'Care team contact is on' : 'Care team contact is off'); } catch (x) { toast(x.message); }
}

/* ---------- journey ---------- */
const avg = a => a.length ? (a.reduce((t, p) => t + p.mood, 0) / a.length).toFixed(1) : '–';
const line = (a, W, H, lab) => {
  const x = i => 20 + i * (W - 40) / Math.max(a.length - 1, 1), y = v => H - 18 - (v - 1) * (H - 36) / 4;
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;margin-top:8px" stroke-width="1.5">${[1, 3, 5].map(v => `<path d="M20 ${y(v)}H${W - 20}" stroke="#BFE0CE" stroke-dasharray="3 4"/>`).join('')}<polyline points="${a.map((p, i) => x(i) + ',' + y(p.mood)).join(' ')}" stroke="#0B7A4B" stroke-width="2.5"/>${a.map((p, i) => `<rect x="${x(i) - 4}" y="${y(p.mood) - 4}" width="8" height="8" fill="#fff" stroke="#0B7A4B" stroke-width="2"/>${lab ? `<text x="${x(i)}" y="${H - 3}" font-size="9" text-anchor="middle" fill="#5A6F63" stroke="none">${fmtD(p.created_at)}</text>` : ''}`).join('')}</svg>`;
};
function renderJourney() {
  const n = hist.length, tr = n >= 4 ? avg(hist.slice(-3)) - avg(hist.slice(0, 3)) : 0;
  $('#jstats').innerHTML = `<div class="card stat"><b>${n ? avg(hist) + '/5' : '–'}</b><span class="muted">average mood</span></div><div class="card stat"><b>${n}</b><span class="muted">check-ins</span></div><div class="card stat"><b>${n < 4 ? '–' : tr > 0.2 ? 'Rising' : tr < -0.2 ? 'Dipping' : 'Steady'}</b><span class="muted">recent trend</span></div>`;
  $('#jchart').innerHTML = n ? line(hist.slice(-12), 340, 170, true) : '<p class="muted" style="margin:8px 0 0">Do your first check-in to see your trend.</p>';
  $('#jlist').innerHTML = hist.slice().reverse().slice(0, 6).map(p => `<div class="li"><span><span class="dot"></span>${fmtD(p.created_at)}</span><span class="muted">Mood ${p.mood}/5 · Stress ${p.stress}/5</span></div>`).join('') || '<p class="muted">No check-ins yet.</p>';
  $('#hStreak').textContent = n; $('#hMood').textContent = n ? hist[n - 1].mood + '/5' : '–';
  renderBmood(); renderNext();
}
function renderBmood() {
  const l4 = hist.slice(-4);
  $('#bmood').innerHTML = l4.length
    ? `<b>Your last check-ins</b>${line(l4, 340, 90, false)}<p class="muted" style="margin:6px 0 10px">Average mood ${avg(l4)}/5. Sharing helps your counselor start faster.</p><button class="chip" id="shareB" aria-pressed="${share}">Share mood summary</button>`
    : '<b>Your last check-ins</b><p class="muted" style="margin:4px 0 0">No check-ins yet. Do one first so a counselor can see how you have been.</p>';
}
function renderNext() {
  const nx = bookings.find(b => new Date(b.starts_at) > new Date());
  $('#hNext').textContent = nx ? fmtDT(nx.starts_at) : 'None yet';
}

/* ---------- care card (student side) ---------- */
const bub = (m, careView) => `<div class="m ${(m.sender_role === 'care') === careView ? 'me' : 'bot'}">${esc(m.body)}</div>`;
function renderCareCard() {
  const a = alertData;
  $('#care').innerHTML = `<b>Care team</b><p class="muted" style="margin:2px 0 10px">Verified, approved responders. They only see flagged check-ins if you allow it.</p><button class="chip" id="consentJ" aria-pressed="${consent}">Allow care team to contact me</button>` +
    (a.alert ? `<div class="msgs thread" style="margin-top:12px">${a.messages.length ? a.messages.map(m => bub(m, false)).join('') : '<p class="muted">Your check-in was flagged. A care team member will reply here soon.</p>'}</div><div class="row" style="flex-wrap:nowrap;margin-top:8px"><input class="cin" id="sReply" maxlength="2000" placeholder="Reply to the care team" aria-label="Reply"><button class="btn" id="sSend">Send</button></div>` : '<p class="muted" style="margin:12px 0 0">No messages yet.</p>');
  $('#consentChk').setAttribute('aria-pressed', String(consent));
}
async function sendStudent() {
  const i = $('#sReply'), v = i.value.trim(); if (!v || !alertData.alert) return;
  try { await WB.replyAsStudent(alertData.alert.id, v); await loadAlert(); renderCareCard(); } catch (x) { toast(x.message); }
}
async function savePhone() {
  try { await WB.profile($('#phoneIn').value); me.phone = $('#phoneIn').value.trim() || null; toast('Contact number saved'); } catch (x) { toast(x.message); }
}
async function exportData() {
  try { const d = await WB.exportData(); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })); a.download = 'wellbridge-my-data.json'; a.click(); } catch (x) { toast(x.message); }
}
async function deleteAccount() {
  if (!confirm('Delete your account and all your data? This cannot be undone.')) return;
  try { await WB.deleteAccount(); location.replace('/'); } catch (x) { toast(x.message); }
}

/* ---------- booking ---------- */
const hair = ['M8 8q4-6 8 0', 'M8 9q0-6 4-6t4 6', 'M7 11q-1-8 5-8t5 8', 'M8 7h8'];
function renderBook() {
  $('#pros').innerHTML = counselors.length ? counselors.map((p, i) => `<button class="pro" data-i="${p.id}" aria-pressed="${bk.c === p.id}"><span class="av"><svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="4"/><path d="M4 22c0-5 3.5-7 8-7s8 2 8 7"/><path d="${hair[i % 4]}"/></svg></span><span><b>${esc(p.name)}</b><br><span class="muted">${esc(p.specialty)}</span></span></button>`).join('') : '<p class="muted">No counselors are available yet. Please check back soon.</p>';
}
$('#pros').onclick = e => { const b = e.target.closest('.pro'); if (!b) return; bk.c = b.dataset.i; renderBook(); refreshTimes(); };
const upd = () => { $('#confirm').disabled = !(bk.c && bk.d && bk.t); };
function nextDays() {
  const out = []; const d = new Date(Date.now() + 3600e3); d.setUTCDate(d.getUTCDate() + 1);
  while (out.length < 5) { const w = d.getUTCDay(); if (w && w < 6) out.push([d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }), d.toISOString().slice(0, 10)]); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}
chips('#days', nextDays(), v => { bk.d = v; refreshTimes(); });
chips('#times', ['09:00', '10:30', '12:00', '14:00', '15:30'].map(t => [t, t]), v => { bk.t = v; upd(); });
chips('#kind', ['In person', 'Video', 'Chat'].map(t => [t, t]), v => { bk.k = v; });
$('#kind').children[0].setAttribute('aria-pressed', 'true');
async function refreshTimes() {
  upd(); if (!bk.c || !bk.d) return;
  let taken = []; try { taken = (await WB.slots(bk.c)).taken; } catch {}
  const set = new Set(taken.map(x => new Date(x).getTime()));
  [...$('#times').children].forEach(b => {
    b.disabled = set.has(new Date(`${bk.d}T${b.dataset.v}:00+01:00`).getTime()); b.style.opacity = b.disabled ? .4 : 1;
    if (b.disabled && bk.t === b.dataset.v) { bk.t = null; b.setAttribute('aria-pressed', 'false'); }
  }); upd();
}
$('#confirm').onclick = async () => {
  const btn = $('#confirm'); btn.disabled = true;
  try {
    await WB.book({ counselorId: bk.c, startsAt: `${bk.d}T${bk.t}:00+01:00`, kind: bk.k, shareSummary: share });
    await loadBookings(); renderBookings(); renderNext();
    const o = $('#booked'); o.hidden = false; o.innerHTML = `<b>Booked.</b><p>${esc(counselors.find(c => c.id === bk.c)?.name)}, ${fmtDT(`${bk.d}T${bk.t}:00+01:00`)}.${share ? ' Mood summary shared.' : ''}</p>`;
    toast('Booking confirmed');
  } catch (x) { toast(x.message); } finally { refreshTimes(); }
};
function renderBookings() {
  const up = bookings.filter(b => new Date(b.starts_at) > new Date());
  $('#myBookings').innerHTML = up.map(b => `<div class="li"><span><b>${esc(b.counselor)}</b><small>${fmtDT(b.starts_at)} · ${esc(b.kind)}</small></span><button class="btn alt" data-cancel="${b.id}">Cancel</button></div>`).join('') || '<p class="muted">No upcoming bookings.</p>';
}
async function cancelBooking(id) {
  if (!confirm('Cancel this booking?')) return;
  try { await WB.cancel(id); await loadBookings(); renderBookings(); renderNext(); refreshTimes(); toast('Booking cancelled'); } catch (x) { toast(x.message); }
}

/* ---------- library ---------- */
const guides = { 'Exam stress': 'Study in 25-minute blocks. Sleep beats all-nighters.', 'Better sleep': 'Same wake time daily. No screens an hour before bed.', 'Panic': 'Breathe out longer than you breathe in. Name 5 things you see.', 'Loneliness': 'Join one small group this week.', 'Money': 'Ask the financial aid office early. Hardship funds may exist.', 'Burnout': 'Drop one commitment. Rest is part of studying.' };
const gIcons = ['M4 4h16v16H4zM8 9h8M8 13h5', 'M20 14A8 8 0 1110 4a6 6 0 0010 10z', 'M2 12q5-8 10 0t10 0', 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-4 3-6 6-6s6 2 6 6M17 8a3 3 0 010 6M21 20c0-3-1-5-3-6', 'M12 3v18M16 7H10a3 3 0 000 6h4a3 3 0 010 6H8', 'M3 8h16v8H3zM19 10h2v4h-2zM6 11v2'];
$('#guides').innerHTML = Object.keys(guides).map((k, i) => `<button class="card" style="text-align:left;font-weight:800" data-g="${k}"><div class="ico"><svg viewBox="0 0 24 24"><path d="${gIcons[i]}"/></svg></div>${k}<br><span class="muted" style="font-weight:400">2 min</span></button>`).join('');
$('#guides').onclick = e => { const b = e.target.closest('[data-g]'); if (!b) return; const o = $('#guideOut'); o.hidden = false; o.innerHTML = `<b>${b.dataset.g}</b><p style="margin:4px 0 0">${guides[b.dataset.g]}</p>`; o.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); };
let tm = null, bn = 0;
$('#bBtn').onclick = () => {
  const el = $('#breath'), b = $('#bBtn');
  if (tm) { clearInterval(tm); tm = null; el.classList.remove('in'); el.textContent = 'Ready'; b.textContent = 'Start'; return; }
  b.textContent = 'Stop'; bn = 0;
  const step = () => { const i = bn % 2 === 0; el.classList.toggle('in', i); el.textContent = i ? 'In' : 'Out'; if (++bn > 15) { clearInterval(tm); tm = null; el.classList.remove('in'); el.textContent = 'Done'; b.textContent = 'Again'; } };
  step(); tm = setInterval(step, 4000);
};

/* ---------- AI assistant ---------- */
const convo = []; let busy = false; const msgsEl = $('#msgs');
function addMsg(t, who) { const d = document.createElement('div'); d.className = 'm ' + who; d.textContent = t; msgsEl.appendChild(d); msgsEl.scrollTop = 1e9; return d; }
function fallback(t) {
  t = t.toLowerCase();
  if (/exam|test|revis/.test(t)) return 'Try 25-minute study blocks with 5-minute breaks, and start with the hardest topic. The Library has an exam stress guide.';
  if (/sleep|tired|insomnia/.test(t)) return 'Keep the same wake time daily and avoid screens an hour before bed. The Library has a short sleep guide.';
  if (/lonely|alone|friend/.test(t)) return 'That feels hard. Joining one small group this week can help, and you can book a counselor in Book.';
  if (/book|counsel|appointment/.test(t)) return 'Open Book, pick a counselor, day and time. It is free and you do not need to give a reason.';
  return 'Thanks for sharing. A quick check-in or a one-minute breathing exercise can help, or you can book a counselor any time.';
}
async function ask(text) {
  text = text.trim(); if (!text || busy) return; busy = true; $('#chatGo').disabled = true;
  addMsg(text, 'me'); convo.push({ role: 'user', content: text });
  if (CRISIS.test(text)) openSos();
  const out = addMsg('Typing…', 'bot'); let reply;
  try { const r = await WB.chat(convo.slice(-10)); reply = r.reply; if (r.crisis) openSos(); }
  catch (x) { reply = x.status === 429 ? 'You have sent a lot of messages. Please try again later, or use Book or Urgent help.' : fallback(text); }
  out.textContent = reply; convo.push({ role: 'assistant', content: reply }); busy = false; $('#chatGo').disabled = false; msgsEl.scrollTop = 1e9;
}
addMsg('Hi, I’m WellBridge Assistant. Ask me about stress, studying or using this app. For urgent help, tap the red button.', 'bot');
chips('#quick', ['I’m stressed about exams', 'I can’t sleep', 'I feel lonely', 'How do I book?'].map(d => [d, d]), v => { ask(v); [...$('#quick').children].forEach(c => c.setAttribute('aria-pressed', 'false')); });
$('#chatGo').onclick = () => { const i = $('#chatIn'), v = i.value; i.value = ''; ask(v); };
$('#chatIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('#chatGo').click(); });

/* ---------- care team and admin ---------- */
async function loadCare() {
  $('#careWho').textContent = `${me.name} · ${me.role === 'admin' ? 'Admin' : 'Verified responder'}`;
  const isAdmin = me.role === 'admin';
  $('#careCols').hidden = isAdmin; $('#cstats').hidden = isAdmin;
  if (me.role === 'care' && me.care_status !== 'approved') {
    $('#careMsg').textContent = me.care_status === 'rejected' ? 'Your application was not approved.' : 'Your license is being verified. You will get access once an admin approves you.';
    $('#careCols').hidden = true; $('#cstats').hidden = true; return;
  }
  if (isAdmin) loadApplicants(); else refreshQueue();
  loadTrends();
}
async function refreshQueue() {
  try { queue = (await WB.careAlerts()).alerts; renderQueue(); } catch (x) { $('#careMsg').textContent = x.message; }
}
function renderQueue() {
  $('#queue').innerHTML = queue.map(a => `<button class="li qi" data-q="${a.id}" aria-pressed="${a.id === selAlert}"><span><b>${esc(a.student)}</b> · ${esc(a.status)}<small>${esc(a.cause || '')} · mood ${a.mood}/5 · stress ${a.stress}/5 · ${fmtDT(a.created_at)}</small></span><span class="pri ${esc(a.level)}">${esc(a.level)}</span></button>`).join('') || '<p class="muted">No flagged check-ins right now.</p>';
  const n = s => queue.filter(a => a.status === s).length;
  $('#cstats').innerHTML = `<div class="card stat"><b>${n('New')}</b><span class="muted">waiting for reply</span></div><div class="card stat"><b>${n('Replied')}</b><span class="muted">replied</span></div><div class="card stat"><b>${n('Escalated')}</b><span class="muted">escalated</span></div>`;
}
async function openAlert(id) {
  selAlert = id; renderQueue(); let msgs = [];
  try { msgs = (await WB.careMessages(id)).messages; } catch (x) { toast(x.message); }
  const a = queue.find(q => q.id === id); if (!a) return;
  $('#convo').innerHTML = `<b>${esc(a.student)}</b> <span class="pri ${esc(a.level)}">${esc(a.level)}</span><p class="muted" style="margin:4px 0 8px">${esc(a.cause || '')} · mood ${a.mood}/5 · stress ${a.stress}/5 · contact allowed</p><div class="msgs thread">${msgs.length ? msgs.map(m => bub(m, true)).join('') : '<p class="muted">No messages yet.</p>'}</div>
<div class="row" style="margin:8px 0"><button class="chip" data-qr="Hi, I’m from the care team. Can we talk today?">Say hello</button><button class="chip" data-qr="You can book a free counseling slot in the Book tab whenever suits you.">Suggest booking</button><button class="chip" data-qr="There’s a short breathing guide in your Library if it helps right now.">Share guide</button></div>
<div class="row" style="flex-wrap:nowrap"><input class="cin" id="cReply" maxlength="2000" placeholder="Write a reply" aria-label="Reply"><button class="btn" id="cSend">Reply</button></div>
<p style="margin:10px 0 0"><button class="btn alt" id="escal" style="color:var(--danger);border-color:var(--danger)">Escalate</button></p>`;
}
async function careSend(text) {
  if (!selAlert || !String(text).trim()) return;
  try { await WB.careReply(selAlert, text); toast('Reply sent'); await refreshQueue(); await openAlert(selAlert); } catch (x) { toast(x.message); }
}
async function escalate() {
  if (!selAlert || !confirm('Escalate this alert? This reveals the student’s name and contact details to the duty officer and to you.')) return;
  try {
    const r = await WB.careEscalate(selAlert); await refreshQueue(); await openAlert(selAlert);
    const s = r.student;
    $('#convo').insertAdjacentHTML('beforeend', `<div class="res"><b>Escalated.</b><p style="margin:4px 0 0">Student: ${esc(s.name)}<br>Email: ${esc(s.email)}<br>Phone: ${esc(s.phone || 'not provided')}</p><p style="margin:6px 0 0">${r.notified ? 'The duty officer has been notified. Follow your emergency procedure.' : 'No emergency contact is set up. Contact the student and your emergency service directly.'}</p></div>`);
  } catch (x) { toast(x.message); }
}
async function loadApplicants() {
  const box = $('#adminBox'); box.hidden = false;
  try {
    const a = (await WB.applicants()).applicants;
    box.innerHTML = '<b>Care team applicants</b>' + (a.map(u => `<div class="li" style="margin-top:8px"><span><b>${esc(u.name)}</b><small>${esc(u.email)} · ${esc(u.license_body)} ${esc(u.license_no)}</small></span><span class="row"><button class="btn" data-ap="1" data-id="${u.id}">Approve</button><button class="btn alt" data-ap="0" data-id="${u.id}">Reject</button></span></div>`).join('') || '<p class="muted" style="margin:6px 0 0">No applications waiting. Check each license with its licensing body before approving.</p>');
  } catch (x) { box.innerHTML = '<p class="muted">' + esc(x.message) + '</p>'; }
}
async function decide(id, ok) {
  if (!confirm(ok ? 'Approve this responder? Confirm their license first.' : 'Reject this application?')) return;
  try { await WB.decide(id, ok); toast(ok ? 'Approved' : 'Rejected'); loadApplicants(); } catch (x) { toast(x.message); }
}
async function loadTrends() {
  try {
    const w = (await WB.trends()).weeks;
    $('#bars').innerHTML = w.length ? w.map(v => `<div class="bar" style="height:${v.avg_stress / 5 * 100}%"><span>${v.avg_stress}</span></div>`).join('') : '<p class="muted" style="align-self:center;margin:auto">Not enough data yet. Weeks with fewer than 10 students are hidden.</p>';
    $('#barLabels').innerHTML = w.map(v => `<div>${fmtD(v.week)}</div>`).join('');
  } catch {}
}
setInterval(async () => {
  if (document.hidden || !me) return;
  try {
    if (me.role === 'care' && me.care_status === 'approved' && currentView() === 'staff') { await refreshQueue(); }
    if (me.role === 'student' && currentView() === 'journey' && !document.activeElement?.matches?.('#sReply')) { const n = alertData.messages.length; await loadAlert(); if (alertData.messages.length !== n) renderCareCard(); }
  } catch {}
}, 20000);

/* ---------- start ---------- */
(async () => {
  try { cfg = await WB.config(); } catch {}
  const t = new URLSearchParams(location.search).get('reset');
  if (t) { resetToken = t; setMode('newpw'); } else setMode('up');
  initGoogle();
  try { await enter((await WB.me()).user); } catch {}
})();
