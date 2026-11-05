# WellBridge (Netlify + Postgres)

Static site in `public/` and one serverless API in `netlify/functions/api.mjs` (served at `/api/*`).

## Deploy
1. **Database.** Create a Postgres database (Neon or Supabase). Copy the pooled connection string.
2. **Schema.** Run `db/schema.sql` in its SQL editor. Add your real counselors:
   `insert into counselors(name,specialty) values ('Name','Specialty');`
   (`db/seed-demo.sql` has fictional demo names. Do not use it in production.)
3. **GitHub.** Push this folder to a repository.
4. **Netlify.** Add new site > Import from Git. Build command: empty. Publish directory: `public`.
5. **Environment variables.** Add the ones in `.env.example`. Make `JWT_SECRET` with `openssl rand -hex 32`.
6. **Google sign-in.** In Google Cloud Console create an OAuth client (Web). Add your Netlify URL under Authorized JavaScript origins. Put its Client ID in `GOOGLE_CLIENT_ID`.
7. **Deploy**, open the site and sign up with your own email.
8. **First admin.** Run: `update users set role='admin' where email='you@example.com';`

## How it works
- **Students** check in, see their journey, book counselors, chat with the AI assistant, and can switch on care team contact.
- **Flagged check-in** (stress 4-5 or mood 1-2) with contact switched on creates an alert. `CARE_NOTIFY_EMAIL` / `CARE_NOTIFY_PHONE` are told (no student details). High alerts also send an SMS.
- **Care team** applies from the landing page footer. An admin checks the license and approves. Approved responders see flagged check-ins as an anonymous ID and can reply. The student gets an email saying there is a new message (no content).
- **Escalate** reveals the student's name, email and phone to the responder, emails and texts the duty officer (`ESCALATION_EMAIL`, `ESCALATION_PHONE`), and is written to `audit_log`.
- **Admins** approve responders and see anonymous trends (groups under 10 hidden). They cannot read student messages.
- **Students** can save an optional phone number, download their data, or delete their account in Journey.

## Before launch
- Replace the demo counselors and set the contact, security, crisis and counseling values.
- Fill in the care alert and escalation contacts, and verify the number for 112 and your helplines.
- Turn on database backups and a Netlify alert for function errors.
- Without `RESEND_API_KEY` no emails are sent. Without `TERMII_API_KEY` no texts are sent.
- The Terms and Privacy Policy are written in `public/app.js` (`legal`). Edit the wording there.
