import pg from 'pg';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify, createRemoteJWKSet } from 'jose';
import { randomBytes, createHash } from 'node:crypto';

const pool = (globalThis.__wbPool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 }));
const q = (text, params) => pool.query(text, params);
const secret = () => new TextEncoder().encode(process.env.JWT_SECRET);
const DUMMY = bcrypt.hashSync('dummy-password', 12);
const GOOGLE_KEYS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const sha = s => createHash('sha256').update(s).digest('hex');
const alias = id => 'S-' + sha(id + process.env.JWT_SECRET).slice(0, 6).toUpperCase();
const UUID = '[0-9a-f-]{36}';
const CRISIS = /suicid|kill myself|end my life|self.?harm|hurt myself|want to die|don.t want to live/i;
const CHAT_SYSTEM = 'You are WellBridge Assistant, a warm, calm support chatbot for Nigerian university students. Reply in 1 to 3 short sentences in plain words with one practical tip. You are not a therapist and never diagnose. Point to app features when useful: Check-in, My journey, Book (free confidential counselor), Library (breathing and guides). If the student mentions self-harm or danger, urge them to tap Urgent help or call emergency services (112) now. Never invent facts about the university.';

async function notify(to, subject, text) {
  const list = String(to || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!process.env.RESEND_API_KEY || !list.length) return;
  try {
    await fetch('https://api.resend.com/emails', { method: 'POST',
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: list, subject, text }) });
  } catch (e) { console.error('mail failed', e.message); }
}
async function sms(to, text) {
  if (!process.env.TERMII_API_KEY) return;
  for (const n of String(to || '').split(',').map(s => s.trim()).filter(Boolean)) {
    try {
      await fetch('https://api.ng.termii.com/api/sms/send', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: n, from: process.env.TERMII_SENDER || 'WellBridge', sms: text, type: 'plain', channel: 'generic', api_key: process.env.TERMII_API_KEY }) });
    } catch (e) { console.error('sms failed', e.message); }
  }
}
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });
const err = (status, message, extra = {}) => json({ error: message, ...extra }, status);
const okEmail = s => /^\S+@\S+\.\S+$/.test(s) && s.length <= 254;
const clean = (s, n) => String(s ?? '').trim().slice(0, n);
const audit = (actor, action, target) => q('insert into audit_log(actor_id,action,target) values($1,$2,$3)', [actor, action, target]);

async function session(user) {
  const token = await new SignJWT({ role: user.role }).setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id).setIssuedAt().setExpirationTime('7d').sign(secret());
  return json({ ok: true, role: user.role }, 200, { 'set-cookie': `wb_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800` });
}
async function currentUser(req) {
  const m = (req.headers.get('cookie') || '').match(/(?:^|; )wb_session=([^;]+)/);
  if (!m) return null;
  try {
    const { payload } = await jwtVerify(m[1], secret());
    const r = await q('select id,email,name,phone,role,care_status,care_contact_consent from users where id=$1', [payload.sub]);
    return r.rows[0] || null;
  } catch { return null; }
}
const isCare = u => u.role === 'care' && u.care_status === 'approved';

export default async (req) => {
  try { return await handle(req); }
  catch (e) { console.error(e); return err(500, 'Something went wrong. Please try again.'); }
};
export const config = { path: '/api/*' };

async function handle(req) {
  const url = new URL(req.url), m = req.method;
  const p = url.pathname.replace(/^\/api/, '').replace(/\/$/, '') || '/';
  if (m !== 'GET') {
    const o = req.headers.get('origin');
    if (o && new URL(o).host !== url.host) return err(403, 'Request blocked');
  }
  let b = {};
  if (m === 'POST' || m === 'PUT') { try { b = await req.json(); } catch { return err(400, 'Invalid request'); } }
  let x;

  // ---------- public ----------
  if (m === 'GET' && p === '/config')
    return json({ googleClientId: process.env.GOOGLE_CLIENT_ID || null, contactEmail: process.env.CONTACT_EMAIL || null, contacts: {
      security: process.env.SECURITY_PHONE || null, crisis: process.env.CRISIS_PHONE || null, counseling: process.env.COUNSELING_PHONE || null } });
  if (m === 'POST' && p === '/auth/signup') {
    const name = clean(b.name, 80), email = clean(b.email, 254).toLowerCase(), pw = String(b.password ?? '');
    if (!name) return err(400, 'Enter your name');
    if (!okEmail(email)) return err(400, 'Enter a valid email');
    if (pw.length < 8 || pw.length > 128) return err(400, 'Password must be 8 to 128 characters');
    if (!b.acceptTerms) return err(400, 'Please accept the Terms and Privacy Policy');
    try {
      const r = await q('insert into users(email,name,password_hash,terms_accepted_at) values($1,$2,$3,now()) returning id,role',
        [email, name, await bcrypt.hash(pw, 12)]);
      return session(r.rows[0]);
    } catch (e) { if (e.code === '23505') return err(409, 'An account with this email already exists'); throw e; }
  }
  if (m === 'POST' && p === '/auth/login') {
    const email = clean(b.email, 254).toLowerCase(), pw = String(b.password ?? '');
    await q("delete from auth_failures where created_at<now()-interval '1 day'");
    const f = await q("select count(*)::int n from auth_failures where email=$1 and created_at>now()-interval '15 minutes'", [email]);
    if (f.rows[0].n >= 5) return err(429, 'Too many attempts. Try again in 15 minutes.');
    const u = (await q('select id,role,password_hash from users where email=$1', [email])).rows[0];
    const good = await bcrypt.compare(pw, u?.password_hash || DUMMY);
    if (!u || !u.password_hash || !good) {
      await q('insert into auth_failures(email) values($1)', [email]);
      return err(401, 'Incorrect email or password');
    }
    await q('delete from auth_failures where email=$1', [email]);
    return session(u);
  }
  if (m === 'POST' && p === '/auth/google') {
    let c;
    try {
      ({ payload: c } = await jwtVerify(String(b.credential ?? ''), GOOGLE_KEYS, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: process.env.GOOGLE_CLIENT_ID }));
    } catch { return err(401, 'Google sign-in failed'); }
    if (!c.email_verified) return err(401, 'Google email is not verified');
    const email = String(c.email).toLowerCase();
    let u = (await q('select id,role from users where email=$1', [email])).rows[0];
    if (u) await q('update users set google_sub=coalesce(google_sub,$2) where id=$1', [u.id, c.sub]);
    else {
      if (!b.acceptTerms) return err(409, 'Please accept the Terms and Privacy Policy', { needTerms: true });
      u = (await q('insert into users(email,name,google_sub,terms_accepted_at) values($1,$2,$3,now()) returning id,role',
        [email, clean(c.name || email.split('@')[0], 80), c.sub])).rows[0];
    }
    return session(u);
  }
  if (m === 'POST' && p === '/auth/logout')
    return json({ ok: true }, 200, { 'set-cookie': 'wb_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0' });
  if (m === 'POST' && p === '/auth/forgot') {
    const email = clean(b.email, 254).toLowerCase();
    await q('delete from reset_tokens where expires_at<now()');
    const u = (await q('select id from users where email=$1 and password_hash is not null', [email])).rows[0];
    if (u) {
      const token = randomBytes(32).toString('hex');
      await q("insert into reset_tokens(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 hour')", [sha(token), u.id]);
      if (process.env.RESEND_API_KEY) {
        await fetch('https://api.resend.com/emails', { method: 'POST',
          headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
          body: JSON.stringify({ from: process.env.MAIL_FROM, to: email, subject: 'Reset your WellBridge password',
            text: `Use this link within 1 hour: ${process.env.SITE_URL}/?reset=${token}` }) });
      }
    }
    return json({ ok: true }); // same answer whether or not the account exists
  }
  if (m === 'POST' && p === '/auth/reset') {
    const pw = String(b.password ?? '');
    if (pw.length < 8 || pw.length > 128) return err(400, 'Password must be 8 to 128 characters');
    const r = await q('delete from reset_tokens where token_hash=$1 and expires_at>now() returning user_id', [sha(String(b.token ?? ''))]);
    if (!r.rows[0]) return err(400, 'This reset link is invalid or has expired');
    await q('update users set password_hash=$2 where id=$1', [r.rows[0].user_id, await bcrypt.hash(pw, 12)]);
    return json({ ok: true });
  }
  if (m === 'POST' && p === '/care/apply') {
    const name = clean(b.name, 80), email = clean(b.email, 254).toLowerCase(), pw = String(b.password ?? '');
    const lic = clean(b.licenseNo, 60), body = clean(b.licenseBody, 120);
    if (!name || !okEmail(email) || pw.length < 8 || !lic || !body) return err(400, 'Fill in all fields');
    try {
      await q("insert into users(email,name,password_hash,role,care_status,license_no,license_body,terms_accepted_at) values($1,$2,$3,'care','pending',$4,$5,now())",
        [email, name, await bcrypt.hash(pw, 12), lic, body]);
      return json({ ok: true, message: 'Application received. An admin will verify your license.' });
    } catch (e) { if (e.code === '23505') return err(409, 'An account with this email already exists'); throw e; }
  }

  // ---------- signed in ----------
  const user = await currentUser(req);
  if (!user) return err(401, 'Sign in required');
  const isStudent = user.role === 'student';

  if (m === 'GET' && p === '/me') return json({ user });
  if (m === 'GET' && p === '/me/export') {
    const id = user.id, g = async (s) => (await q(s, [id])).rows;
    return json({ exportedAt: new Date().toISOString(), user,
      checkins: await g('select * from checkins where user_id=$1'), bookings: await g('select * from bookings where user_id=$1'),
      consentHistory: await g('select * from consent_events where user_id=$1'),
      careConversations: await g('select a.id,a.level,a.status,a.created_at,(select json_agg(m order by m.created_at) from messages m where m.alert_id=a.id) messages from alerts a where a.user_id=$1') });
  }
  if (m === 'DELETE' && p === '/me') {
    await audit(null, 'account_deleted', alias(user.id));
    await q('delete from users where id=$1', [user.id]);
    return json({ ok: true }, 200, { 'set-cookie': 'wb_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0' });
  }

  // ---------- student ----------
  if (m === 'PUT' && p === '/consent') {
    const v = b.careContact === true;
    await q('update users set care_contact_consent=$2 where id=$1', [user.id, v]);
    await q("insert into consent_events(user_id,kind,granted) values($1,'care_contact',$2)", [user.id, v]);
    return json({ ok: true, careContact: v });
  }
  if (m === 'PUT' && p === '/me/profile') {
    const ph = clean(b.phone, 20);
    if (ph && !/^\+?[0-9 ()-]{7,20}$/.test(ph)) return err(400, 'Enter a valid phone number');
    await q('update users set phone=$2 where id=$1', [user.id, ph || null]);
    return json({ ok: true });
  }
  if (m === 'POST' && p === '/checkins') {
    if (!isStudent) return err(403, 'Students only');
    const mood = +b.mood, stress = +b.stress;
    if (![1, 2, 3, 4, 5].includes(mood) || ![1, 2, 3, 4, 5].includes(stress)) return err(400, 'Mood and stress must be 1 to 5');
    const cause = ['Exams', 'Money', 'Lonely', 'Future', 'Other'].includes(b.cause) ? b.cause : 'Other';
    const c = (await q('insert into checkins(user_id,mood,stress,cause) values($1,$2,$3,$4) returning id,created_at', [user.id, mood, stress, cause])).rows[0];
    const heavy = stress >= 4 || mood <= 2;
    let alertId = null;
    if (heavy && user.care_contact_consent) {
      const open = (await q("select id from alerts where user_id=$1 and status in ('New','Replied') limit 1", [user.id])).rows[0];
      if (open) alertId = open.id;
      else {
        const level = stress === 5 || mood === 1 ? 'High' : 'Medium';
        alertId = (await q('insert into alerts(user_id,checkin_id,level) values($1,$2,$3) returning id', [user.id, c.id, level])).rows[0].id;
        await notify(process.env.CARE_NOTIFY_EMAIL, `New ${level} flagged check-in`, `A student who allowed care team contact has a new ${level} flagged check-in. Sign in to WellBridge to respond.`);
        if (level === 'High') await sms(process.env.CARE_NOTIFY_PHONE, 'WellBridge: new HIGH flagged check-in. Please sign in to respond.');
      }
    }
    return json({ ok: true, checkin: c, flagged: heavy, alertId, careContact: user.care_contact_consent });
  }
  if (m === 'GET' && p === '/checkins')
    return json({ checkins: (await q('select id,mood,stress,cause,created_at from checkins where user_id=$1 order by created_at desc limit 100', [user.id])).rows });
  if (m === 'GET' && p === '/counselors') return json({ counselors: (await q('select id,name,specialty from counselors order by name')).rows });
  if (m === 'GET' && p === '/bookings')
    return json({ bookings: (await q('select b.id,b.starts_at,b.kind,b.share_summary,c.name counselor from bookings b join counselors c on c.id=b.counselor_id where b.user_id=$1 order by b.starts_at', [user.id])).rows });
  if (m === 'POST' && p === '/bookings') {
    const when = new Date(b.startsAt);
    if (!new RegExp('^' + UUID + '$').test(String(b.counselorId))) return err(400, 'Choose a counselor');
    if (isNaN(when) || when < new Date()) return err(400, 'Choose a future time');
    if (!['In person', 'Video', 'Chat'].includes(b.kind)) return err(400, 'Choose a format');
    try {
      const r = await q('insert into bookings(user_id,counselor_id,starts_at,kind,share_summary) values($1,$2,$3,$4,$5) returning id',
        [user.id, b.counselorId, when.toISOString(), b.kind, b.shareSummary === true]);
      return json({ ok: true, id: r.rows[0].id });
    } catch (e) { if (e.code === '23505') return err(409, 'That slot was just taken'); throw e; }
  }
  if (m === 'GET' && p === '/slots') {
    const cid = url.searchParams.get('counselorId') || '';
    if (!new RegExp('^' + UUID + '$').test(cid)) return err(400, 'Choose a counselor');
    return json({ taken: (await q('select starts_at from bookings where counselor_id=$1 and starts_at>now()', [cid])).rows.map(r => r.starts_at) });
  }
  if ((x = p.match(new RegExp(`^/bookings/(${UUID})$`))) && m === 'DELETE') {
    await q('delete from bookings where id=$1 and user_id=$2', [x[1], user.id]);
    return json({ ok: true });
  }
  if (m === 'POST' && p === '/chat') {
    if (!process.env.ANTHROPIC_API_KEY) return err(503, 'Assistant unavailable');
    const used = await q("select count(*)::int n from chat_usage where user_id=$1 and created_at>now()-interval '1 hour'", [user.id]);
    if (used.rows[0].n >= 30) return err(429, 'Too many messages');
    const msgs = [];
    for (const t of (Array.isArray(b.messages) ? b.messages : []).slice(-10)) {
      const role = t?.role === 'assistant' ? 'assistant' : 'user', content = clean(t?.content, 1000);
      if (!content) continue;
      if (msgs.length && msgs.at(-1).role === role) msgs.at(-1).content += '\n' + content; else msgs.push({ role, content });
    }
    while (msgs.length && msgs[0].role !== 'user') msgs.shift();
    if (!msgs.length || msgs.at(-1).role !== 'user') return err(400, 'Write a message');
    await q("delete from chat_usage where created_at<now()-interval '1 day'");
    await q('insert into chat_usage(user_id) values($1)', [user.id]);
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5', max_tokens: 300, system: CHAT_SYSTEM, messages: msgs }) });
    if (!r.ok) { console.error('chat upstream', r.status); return err(502, 'Assistant unavailable'); }
    const d = await r.json();
    return json({ reply: d.content?.find(c => c.type === 'text')?.text || 'Sorry, I could not answer that.',
      crisis: CRISIS.test(msgs.at(-1).content) });
  }
  if (m === 'GET' && p === '/alerts/mine') {
    const a = (await q('select id,level,status,created_at from alerts where user_id=$1 order by created_at desc limit 1', [user.id])).rows[0];
    if (!a) return json({ alert: null, messages: [] });
    return json({ alert: a, messages: (await q('select sender_role,body,created_at from messages where alert_id=$1 order by created_at', [a.id])).rows });
  }
  if ((x = p.match(new RegExp(`^/alerts/(${UUID})/messages$`))) && m === 'POST') {
    const body = clean(b.body, 2000);
    if (!body) return err(400, 'Write a message');
    const a = (await q('select id from alerts where id=$1 and user_id=$2', [x[1], user.id])).rows[0];
    if (!a) return err(404, 'Not found');
    await q("insert into messages(alert_id,sender_role,sender_id,body) values($1,'student',$2,$3)", [a.id, user.id, body]);
    await notify(process.env.CARE_NOTIFY_EMAIL, 'A student replied', 'A student replied on an open alert. Sign in to WellBridge to read it.');
    return json({ ok: true });
  }

  // ---------- verified care team ----------
  if (p.startsWith('/care/') && !isCare(user)) return err(403, 'Verified care team only');
  if (p === '/trends' && !isCare(user) && user.role !== 'admin') return err(403, 'Verified care team only');
  if (m === 'GET' && p === '/care/alerts') {
    const r = await q(`select a.id,a.user_id,a.level,a.status,a.created_at,c.mood,c.stress,c.cause
      from alerts a join users u on u.id=a.user_id and u.care_contact_consent
      left join checkins c on c.id=a.checkin_id
      where a.status<>'Closed' order by (a.status='New') desc,(a.level='High') desc,a.created_at desc limit 100`);
    await audit(user.id, 'care_view_queue', null);
    return json({ alerts: r.rows.map(({ user_id, ...a }) => ({ ...a, student: alias(user_id) })) });
  }
  if ((x = p.match(new RegExp(`^/care/alerts/(${UUID})/(messages|escalate)$`)))) {
    const a = (await q('select a.id,a.status from alerts a join users u on u.id=a.user_id and u.care_contact_consent where a.id=$1', [x[1]])).rows[0];
    if (!a) return err(404, 'Not found or consent withdrawn');
    if (m === 'GET' && x[2] === 'messages') {
      await audit(user.id, 'care_view_alert', a.id);
      return json({ messages: (await q('select sender_role,body,created_at from messages where alert_id=$1 order by created_at', [a.id])).rows });
    }
    if (m === 'POST' && x[2] === 'messages') {
      const body = clean(b.body, 2000);
      if (!body) return err(400, 'Write a message');
      await q("insert into messages(alert_id,sender_role,sender_id,body) values($1,'care',$2,$3)", [a.id, user.id, body]);
      await q("update alerts set status='Replied' where id=$1 and status='New'", [a.id]);
      await audit(user.id, 'care_reply', a.id);
      const stu = (await q('select u.email from alerts a join users u on u.id=a.user_id where a.id=$1', [a.id])).rows[0];
      await notify(stu?.email, 'You have a new message from your WellBridge care team', 'Sign in to WellBridge and open My journey to read it.');
      return json({ ok: true });
    }
    if (m === 'POST' && x[2] === 'escalate') {
      const s = (await q('select u.name,u.email,u.phone,a.level from alerts a join users u on u.id=a.user_id where a.id=$1', [a.id])).rows[0];
      await q("update alerts set status='Escalated' where id=$1", [a.id]);
      await audit(user.id, 'care_escalate_reveal', a.id);
      await notify(process.env.ESCALATION_EMAIL, 'URGENT: WellBridge escalation',
        `${user.name} (care team) escalated a ${s.level} alert.\n\nStudent: ${s.name}\nEmail: ${s.email}\nPhone: ${s.phone || 'not provided'}\n\nPlease follow your emergency procedure now.`);
      await sms(process.env.ESCALATION_PHONE, `WellBridge URGENT: ${s.level} alert escalated. Student ${s.name}, ${s.phone || s.email}. See email.`);
      return json({ ok: true, student: { name: s.name, email: s.email, phone: s.phone },
        notified: Boolean(process.env.ESCALATION_EMAIL || process.env.ESCALATION_PHONE) });
    }
  }
  if (m === 'GET' && p === '/trends') {
    const r = await q(`select date_trunc('week',created_at) week,count(distinct user_id)::int students,round(avg(stress)::numeric,1) avg_stress
      from checkins where created_at>now()-interval '8 weeks' group by 1 having count(distinct user_id)>=10 order by 1`);
    return json({ weeks: r.rows, note: 'Weeks with fewer than 10 students are hidden.' });
  }

  // ---------- admin ----------
  if (p.startsWith('/admin/') && user.role !== 'admin') return err(403, 'Admins only');
  if (m === 'GET' && p === '/admin/care-applicants')
    return json({ applicants: (await q("select id,name,email,license_no,license_body,created_at from users where role='care' and care_status='pending' order by created_at")).rows });
  if ((x = p.match(new RegExp(`^/admin/care/(${UUID})/(approve|reject)$`))) && m === 'POST') {
    const s = x[2] === 'approve' ? 'approved' : 'rejected';
    await q("update users set care_status=$2 where id=$1 and role='care'", [x[1], s]);
    await audit(user.id, 'care_' + s, x[1]);
    return json({ ok: true, status: s });
  }
  return err(404, 'Not found');
}
